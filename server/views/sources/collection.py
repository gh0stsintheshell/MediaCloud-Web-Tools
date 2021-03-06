import logging
from multiprocessing import Pool
from operator import itemgetter
import flask_login
import os
from flask import jsonify, request
from mediacloud.tags import MediaTag, TAG_ACTION_ADD

import server.util.csv as csv
from server import app, mc, db
from server.auth import user_mediacloud_key, user_admin_mediacloud_client, user_mediacloud_client, user_name,\
    user_has_auth_role, ROLE_MEDIA_EDIT
from server.cache import cache, key_generator
from server.util.request import arguments_required, form_fields_required, api_error_handler

from server.util.tags import TAG_SETS_ID_COLLECTIONS, is_metadata_tag_set, format_name_from_label, media_with_tag
from server.views.sources import SOURCE_LIST_CSV_EDIT_PROPS, SOURCE_FEED_LIST_CSV_PROPS
from server.views.favorites import add_user_favorite_flag_to_collections, add_user_favorite_flag_to_sources

from server.views.sources.feeds import source_feed_list
from server.views.sources.geocount import stream_geo_csv, cached_geotag_count
from server.views.stories import QUERY_LAST_YEAR
from server.views.sources.stories_split_by_time import stream_split_stories_csv
import server.views.sources.apicache as apicache
from server.views.sources.words import word_count, stream_wordcount_csv

logger = logging.getLogger(__name__)

HISTORICAL_COUNT_POOL_SIZE = 10  # number of parallel processes to use while fetching historical story counts for each media source
FEED_SCRAPE_JOB_POOL_SIZE = 10


def allowed_file(filename):
    filename, file_extension = os.path.splitext(filename)
    return file_extension.lower() in ['.csv']


@app.route('/api/collections/<collection_id>/metadatacoverage.csv')
@flask_login.login_required
@api_error_handler
def api_metadata_download(collection_id):
    all_media = media_with_tag(user_mediacloud_key(), collection_id)

    metadata_counts = {}  # from tag_sets_id to info
    for media_source in all_media:
        for metadata_label, info in media_source['metadata'].iteritems():
            if metadata_label not in metadata_counts:  # lazily populate counts
                metadata_counts[metadata_label] = {
                    'metadataCoverage': metadata_label,
                    'tagged': 0
                }
            if info is not None:
                metadata_counts[metadata_label]['tagged'] += 1

    for item_info in metadata_counts.values():
        temp = len(all_media) - item_info['tagged']
        item_info.update({'notTagged': temp})

    props = ['metadataCoverage', 'tagged', 'notTagged']
    filename = "metadataCoverageForCollection" + collection_id + ".csv"
    return csv.stream_response(metadata_counts.values(), props, filename,
                               ['metadata category', 'sources with info', 'sources missing info'])


@app.route('/api/collections/set/<tag_sets_id>', methods=['GET'])
@flask_login.login_required
@api_error_handler
def api_collection_set(tag_sets_id):
    '''
    Return a list of all the (public only or public and private, depending on user role) collections in a tag set.  Not cached because this can change, and load time isn't terrible.
    :param tag_sets_id: the tag set to query for public collections
    :return: dict of info and list of collections in
    '''
    if user_has_auth_role(ROLE_MEDIA_EDIT):
        info = apicache.tag_set_with_private_collections(user_mediacloud_key(), tag_sets_id)
    else:
        info = apicache.tag_set_with_public_collections(user_mediacloud_key(), tag_sets_id)

    add_user_favorite_flag_to_collections(info['tags'])
    # rename to make more sense here
    info['collections'] = sorted(info['tags'], key=itemgetter('label', 'tag'))
    del info['tags']
    return jsonify(info)


# seems that this should have a better name- it's getting a list of sources given a list of collections...
@app.route('/api/collections/list', methods=['GET'])
@arguments_required('coll[]')
@flask_login.login_required
@api_error_handler
def api_collections_by_ids():
    collection_ids = request.args['coll[]'].split(',')
    sources_list = []
    for tags_id in collection_ids:
        all_media = media_with_tag(user_mediacloud_key(), tags_id)
        info = [{'media_id': m['media_id'], 'name': m['name'], 'url': m['url'], 'public_notes': m['public_notes']} for m
                in all_media]
        add_user_favorite_flag_to_sources(info)
        sources_list += info
    return jsonify({'results': sources_list})


@app.route('/api/collections/featured', methods=['GET'])
@api_error_handler
def api_featured_collections():
    featured_collections = apicache.featured_collections()
    return jsonify({'results': featured_collections})


@app.route('/api/collections/<collection_id>/favorite', methods=['PUT'])
@flask_login.login_required
@form_fields_required('favorite')
@api_error_handler
def collection_set_favorited(collection_id):
    favorite = request.form["favorite"]
    username = user_name()
    if int(favorite) == 1:
        db.add_item_to_users_list(username, 'favoriteCollections', int(collection_id))
    else:
        db.remove_item_from_users_list(username, 'favoriteCollections', int(collection_id))
    return jsonify({'isFavorite': favorite})


@app.route('/api/collections/<collection_id>/details')
@flask_login.login_required
@api_error_handler
def api_collection_details(collection_id):
    add_in_sources = False
    if ('getSources' in request.args) and (request.args['getSources'] == 'true'):
        add_in_sources = True

    user_mc = user_mediacloud_client()
    info = user_mc.tag(collection_id)
    add_user_favorite_flag_to_collections([info])
    info['id'] = collection_id
    info['tag_set'] = _tag_set_info(user_mediacloud_key(), info['tag_sets_id'])
    if add_in_sources:
        media_in_collection = media_with_tag(user_mediacloud_key(), collection_id)
        info['sources'] = media_in_collection
    return jsonify({'results': info})

def _media_list_edit_worker(media_id):
    user_mc = user_admin_mediacloud_client()
    # latest scrape job
    scrape_jobs = user_mc.feedsScrapeStatus(media_id)
    latest_scrape_job = None
    if len(scrape_jobs['job_states']) > 0:
        latest_scrape_job = scrape_jobs['job_states'][0]
    # active feed count
    feeds = source_feed_list(media_id)
    active_syndicated_feeds = [f for f in feeds if f['active'] and f['type'] == 'syndicated']
    active_feed_count = len(active_syndicated_feeds)
    query = "media_id:{}".format(media_id)
    full_count = apicache.cached_timeperiod_story_count(user_mc, query, QUERY_LAST_YEAR)['count']
    return {
        'media_id': media_id,
        'latest_scrape_job': latest_scrape_job,
        'active_feed_count': active_feed_count,
        'num_stories_last_year': full_count,
    }


@app.route('/api/collections/<collection_id>/sources')
@flask_login.login_required
@api_error_handler
def api_collection_sources(collection_id):
    add_in_details = False
    if ('details' in request.args) and (request.args['details'] == 'true'):
        add_in_details = True
    results = {
        'tags_id': collection_id
    }
    media_in_collection = media_with_tag(user_mediacloud_key(), collection_id)
    add_user_favorite_flag_to_sources(media_in_collection)
    if add_in_details and user_has_auth_role(ROLE_MEDIA_EDIT):
        media_in_collection = fetch_collection_source_feed_info(media_in_collection)

    results['sources'] = media_in_collection
    return jsonify(results)

def fetch_collection_source_feed_info(media_in_collection):
        # for editing users, add in last scrape and active feed count (if requested)
        use_pool = True
        jobs = [m['media_id'] for m in media_in_collection]
        if use_pool:
            pool = Pool(processes=FEED_SCRAPE_JOB_POOL_SIZE)
            job_results = pool.map(_media_list_edit_worker, jobs)  # blocks until they are all done
        else:
            job_results = [_media_list_edit_worker(job) for job in jobs]

        job_by_media_id = {j['media_id']: j for j in job_results}
        for m in media_in_collection:
            m['num_stories_last_year'] = job_by_media_id[m['media_id']]['num_stories_last_year']
            m['latest_scrape_job'] = job_by_media_id[m['media_id']]['latest_scrape_job']
            m['active_feed_count'] = job_by_media_id[m['media_id']]['active_feed_count']
        if use_pool:
            pool.terminate()
        return media_in_collection

@app.route('/api/template/sources.csv')
@flask_login.login_required
@api_error_handler
def api_download_sources_template():
    filename = "media cloud collection upload template.csv"

    what_type_download = SOURCE_LIST_CSV_EDIT_PROPS

    return csv.stream_response(what_type_download, what_type_download, filename)


@app.route('/api/collections/<collection_id>/sources.csv')
@flask_login.login_required
@api_error_handler
def api_collection_sources_csv(collection_id):
    user_mc = user_mediacloud_client()
    collection = user_mc.tag(collection_id)    # not cached because props can change often
    all_media = media_with_tag(user_mediacloud_key(), collection_id)
    file_prefix = "Collection {} ({}) - sources ".format(collection_id, collection['tag'])
    properties_to_include = SOURCE_LIST_CSV_EDIT_PROPS
    return csv.download_media_csv(all_media, file_prefix, properties_to_include)

@app.route('/api/collections/<collection_id>/sources/<source_type>.csv')
@flask_login.login_required
@api_error_handler
def api_collection_sources_feed_status_csv(collection_id, source_type):
    user_mc = user_mediacloud_client()
    results = {
        'tags_id': collection_id
    }
    collection = user_mc.tag(collection_id)
    type = str(source_type).lower()
    media_in_collection = media_with_tag(user_mediacloud_key(), collection_id)
    media_info_in_collection = fetch_collection_source_feed_info(media_in_collection)
    if type == 'review':
        filtered_media = [m for m in media_info_in_collection if m['active_feed_count'] > 0 and m['num_stories_90'] == 0 and m['num_stories_last_year'] > 0]
    elif type == 'remove':
        filtered_media = [m for m in media_info_in_collection if m['active_feed_count'] > 0 and m['num_stories_90'] == 0 and m['num_stories_last_year'] == 0 and m['latest_scrape_job.state'] == 'failed']
    elif type == 'unscrapeable':
        filtered_media = [m for m in media_info_in_collection if m['active_feed_count'] == 0 and m['num_stories_90'] > 0]
    elif type == 'working':
        filtered_media = [m for m in media_info_in_collection if m['active_feed_count'] > 0 and m['num_stories_last_year'] > 0]
    else:
        filtered_media = media_info_in_collection
    file_prefix = "Collection {} ({}) - sources feed {}".format(collection_id, collection['tag'], source_type)
    properties_to_include = SOURCE_FEED_LIST_CSV_PROPS
    return csv.download_media_csv(filtered_media, file_prefix, properties_to_include)


@app.route('/api/collections/<collection_id>/sources/story-split/historical-counts')
@flask_login.login_required
@api_error_handler
def collection_source_story_split_historical_counts(collection_id):
    results = _collection_source_story_split_historical_counts(collection_id)
    return jsonify({'counts': results})


@app.route('/api/collections/<collection_id>/sources/story-split/historical-counts.csv')
@flask_login.login_required
@api_error_handler
def collection_source_story_split_historical_counts_csv(collection_id):
    results = _collection_source_story_split_historical_counts(collection_id)
    date_cols = None
    #TODO verify this
    for source in results:
        if date_cols is None:
            date_cols = sorted([s['date'] for s in source['splits_over_time']])
        for day in source['splits_over_time']:
            source[day['date']] = day['count']
        del source['splits_over_time']
    props = ['media_id', 'media_name', 'media_url', 'total_stories', 'splits_over_time'] + date_cols
    filename = "{} - source content count".format(collection_id)
    return csv.stream_response(results, props, filename)


# worker function to help in parallel
def _source_story_split_count_worker(info):
    source = info['media']
    q = "media_id:{}".format(source['media_id'])
    split_stories = apicache.last_year_split_story_count(user_mediacloud_key(), q)
    source_data = {
        'media_id': source['media_id'],
        'media_name': source['name'],
        'media_url': source['url'],
        'total_story_count': split_stories['total_story_count'],
        'splits_over_time': split_stories['counts'],
    }
    return source_data


def _collection_source_story_split_historical_counts(collection_id):
    media_list = media_with_tag(user_mediacloud_key(), collection_id)
    jobs = [{'media': m} for m in media_list]
    # fetch in parallel to make things faster
    pool = Pool(processes=HISTORICAL_COUNT_POOL_SIZE)
    results = pool.map(_source_story_split_count_worker, jobs)  # blocks until they are all done
    pool.terminate()  # extra safe garbage collection
    return results


@app.route('/api/collections/<collection_id>/story-split/count')
@flask_login.login_required
@api_error_handler
def collection_source_split_stories(collection_id):
    collections_query = "tags_id_media:{}".format(collection_id)
    exclude_spidered_stories = " tags_id_media:{} AND NOT tags_id_stories:{}".format(str(collection_id),
                                                                                8875452) if 'separate_spidered' in request.args else collections_query
    interval = 'day' # default, and not currently passed to the calls above

    all_results = apicache.last_year_split_story_count(user_mediacloud_key(), collections_query)
    non_spidered_results = apicache.last_year_split_story_count(user_mediacloud_key(),
                                                                exclude_spidered_stories)  # same if request.args doesn't ask to exclude_spidered

    all_stories = {
        'total_story_count': all_results['total_story_count'],
        'list': all_results['counts'],
    }
    partial_stories = {
        'total_story_count': non_spidered_results['total_story_count'],
        'list': non_spidered_results['counts'],
    }
    return jsonify({'results': {'all_stories': all_stories, 'partial_stories': partial_stories, 'interval': interval}})


@app.route('/api/collections/<collection_id>/story-split/count.csv')
@flask_login.login_required
@api_error_handler
def collection_split_stories_csv(collection_id):
    user_mc = user_mediacloud_client()
    return stream_split_stories_csv(user_mediacloud_key(), 'splitStoryCounts-Collection-' + collection_id, collection_id, "tags_id_media")


def _tag_set_info(user_mc_key, tag_sets_id):
    user_mc = user_mediacloud_client()
    return user_mc.tagSet(tag_sets_id)


@app.route('/api/collections/<collection_id>/sources/representation', methods=['GET'])
@flask_login.login_required
@api_error_handler
def api_collection_source_representation(collection_id):
    source_representation = apicache.collection_source_representation(user_mediacloud_key(), collection_id)
    return jsonify({'sources': source_representation})


@app.route('/api/collections/<collection_id>/sources/representation/representation.csv', methods=['GET'])
@flask_login.login_required
@api_error_handler
def api_collection_source_representation_csv(collection_id):
    user_mc = user_mediacloud_client()
    info = user_mc.tag(collection_id)
    source_representation = apicache.collection_source_representation(user_mediacloud_key(), collection_id)
    props = ['media_id', 'media_name', 'media_url', 'stories', 'sample_size', 'story_pct']
    filename = info['label'] + "-source sentence counts.csv"
    return csv.stream_response(source_representation, props, filename)


@app.route('/api/collections/<collection_id>/geography')
@flask_login.login_required
@api_error_handler
def geo_geography(collection_id):
    info = {
        'geography': cached_geotag_count(user_mediacloud_key(), 'tags_id_media:' + str(collection_id))
    }
    return jsonify({'results': info})


@app.route('/api/collections/<collection_id>/geography/geography.csv')
@flask_login.login_required
@api_error_handler
def collection_geo_csv(collection_id):
    return stream_geo_csv(user_mediacloud_key(), 'geography-Collection-' + collection_id, collection_id,
                          "tags_id_media")


@app.route('/api/collections/<collection_id>/words')
@flask_login.login_required
@api_error_handler
def collection_words(collection_id):
    solr_q = 'tags_id_media:' + str(collection_id)
    solr_fq = None
    # add in the publish_date clause if there is one
    if ('q' in request.args) and (len(request.args['q']) > 0):
        solr_fq = request.args['q']
    info = {
        'wordcounts': word_count(user_mediacloud_key, solr_q, solr_fq)
    }
    return jsonify({'results': info})


@app.route('/api/collections/<collection_id>/words/wordcount.csv', methods=['GET'])
@flask_login.login_required
@api_error_handler
def collection_wordcount_csv(collection_id):
    solr_q = 'tags_id_media:' + str(collection_id)
    solr_fq = None
    # add in the publish_date clause if there is one
    if ('q' in request.args) and (len(request.args['q']) > 0):
        solr_fq = request.args['q']
    return stream_wordcount_csv(user_mediacloud_key(), 'wordcounts-Collection-' + collection_id, solr_q, solr_fq)


@app.route('/api/collections/<collection_id>/similar-collections', methods=['GET'])
@flask_login.login_required
@api_error_handler
def similar_collections(collection_id):
    info = {
        'similarCollections': mc.tagList(similar_tags_id=collection_id)
    }
    return jsonify({'results': info})


@app.route('/api/collections/create', methods=['POST'])
@form_fields_required('name', 'description')
@flask_login.login_required
@api_error_handler
def collection_create():
    user_mc = user_admin_mediacloud_client()     # has to be admin to call createTag
    label = '{}'.format(request.form['name'])
    description = request.form['description']
    static = request.form['static'] if 'static' in request.form else None
    show_on_stories = request.form['showOnStories'] if 'showOnStories' in request.form else None
    show_on_media = request.form['showOnMedia'] if 'showOnMedia' in request.form else None
    source_ids = []
    if len(request.form['sources[]']) > 0:
        source_ids = request.form['sources[]'].split(',')

    formatted_name = format_name_from_label(label)
    # first create the collection
    new_collection = user_mc.createTag(TAG_SETS_ID_COLLECTIONS, formatted_name, label, description,
                                       is_static=(static == 'true'),
                                       show_on_stories=(show_on_stories == 'true'),
                                       show_on_media=(show_on_media == 'true'))
    # then go through and tag all the sources specified with the new collection id
    tags = [MediaTag(sid, tags_id=new_collection['tag']['tags_id'], action=TAG_ACTION_ADD) for sid in source_ids]
    if len(tags) > 0:
        user_mc.tagMedia(tags)
    return jsonify(new_collection['tag'])


