import re
import logging
import os
from mediacloud import MediaCloud
from operator import itemgetter
import json
import codecs

from server import base_dir
from server.auth import user_mediacloud_client
from server.cache import cache, key_generator

logger = logging.getLogger(__name__)

STORY_UNDATEABLE_TAG = 8877812  # if a story has this tag, that means it was undateable

# constants related to NYT labels (ie. tags on stories indicating what they are about)
NYT_LABELER_1_0_0_TAG_ID = 9360669  # the tag that indicates a story was tagged by the NYT labeller version 1
NYT_LABELS_TAG_SET_ID = 1963  # the tag set all the descriptor tags are in
NYT_LABELS_SAMPLE_SIZE = 10000  # the sample size to use for looking at NYT descriptor tags
BAD_THEMES = [9360842, 9360856]

# constants for versioning of geo-tagged stories
TAG_SET_GEOCODER_VERSION = 1937
TAG_SET_NYT_LABELS_VERSION = 1964

# constants related to the CLIFF-based geotagging (ie. tags on stories indicating places they are about)
CLIFF_CLAVIN_2_3_0_TAG_ID = 9353691  # the tag that indicates a story was tagged by the CLIFF version 2.3.0
CLIFF_CLAVIN_2_4_1_TAG_ID = 9696677  # the tag that indicates a story was tagged by the CLIFF version 2.4.1
GEO_TAG_SET = 1011  # the tag set all the geo tags are in
GEO_SAMPLE_SIZE = 10000  # the sample size to use for looking at geo tags
CLIFF_ORGS = 2388
CLIFF_PEOPLE = 2389

# Source collection tags sets
TAG_SETS_ID_COLLECTIONS = 5  # holds all the Media Cloud collections
TAG_SET_ID_PARTISAN_RETWEETS = 1959  # holds the partisan retweet quintiles
TAG_SET_ABYZ_GEO_COLLECTIONS = 15765102  # for geographic collections we are importing from ABYZ
VALID_COLLECTION_TAG_SETS_IDS = [TAG_SETS_ID_COLLECTIONS, TAG_SET_ID_PARTISAN_RETWEETS,
                                 TAG_SET_ABYZ_GEO_COLLECTIONS]

# Source metadata tag sets
TAG_SETS_ID_PUBLICATION_COUNTRY = 1935  # holds the country of publication of a source
TAG_SETS_ID_PUBLICATION_STATE = 1962  # holds the state of publication of a source (only US and India right now)
TAG_SETS_ID_PRIMARY_LANGUAGE = 1969  # holds the primary language of a source
TAG_SETS_ID_COUNTRY_OF_FOCUS = 1970  # holds the primary focus on what country for a source
TAG_SETS_ID_MEDIA_TYPE = 1972

TAG_SETS_ID_RETWEET_PARTISANSHIP_2016 = 1959

METADATA_PUB_COUNTRY_NAME = 'pub_country'
METADATA_PUB_STATE_NAME = 'pub_state'
METADATA_PRIMARY_LANGUAGE_NAME = 'primary_language'
METADATA_PRIMARY_COUNTRY_OF_FOCUS_NAME = 'subject_country'
METADATA_MEDIA_TYPE = 'media_type'

# map from metadata category name, to metadata tag set id
VALID_METADATA_IDS = [
    {METADATA_PUB_COUNTRY_NAME: TAG_SETS_ID_PUBLICATION_COUNTRY},
    {METADATA_PUB_STATE_NAME: TAG_SETS_ID_PUBLICATION_STATE},
    {METADATA_PRIMARY_LANGUAGE_NAME: TAG_SETS_ID_PRIMARY_LANGUAGE},
    {METADATA_PRIMARY_COUNTRY_OF_FOCUS_NAME: TAG_SETS_ID_COUNTRY_OF_FOCUS},
    {METADATA_MEDIA_TYPE: TAG_SETS_ID_MEDIA_TYPE},
]


def processed_for_themes_query_clause():
    '''
    :return: A solr query clause you can use to filter for stories that have been tagged by any version
     of our CLIFF geotagging engine (ie. tagged with people, places, and organizations)
    '''
    return u"(tags_id_stories:{})".format(NYT_LABELER_1_0_0_TAG_ID)


def processed_for_entities_query_clause():
    '''
    :return: A solr query clause you can use to filter for stories that have been tagged by any version
     of our CLIFF geotagging engine (ie. tagged with people, places, and organizations)
    '''
    return u"(tags_id_stories:({} {}))".format(CLIFF_CLAVIN_2_4_1_TAG_ID, CLIFF_CLAVIN_2_3_0_TAG_ID)


def processed_for_entities_tag_ids():
    '''
    :return: A list of the tags that mean a story has been processed by some version of CLIFF (ie. the story
     has been tagged with people, places, and organizations)
    '''
    return [CLIFF_CLAVIN_2_3_0_TAG_ID, CLIFF_CLAVIN_2_4_1_TAG_ID]


def is_metadata_tag_set(tag_sets_id):
    '''
    Find out if a tag set is one used to hold metadata on a Source.
    :param tag_sets_id: the id of tag set 
    :return: True if it is a valid metadata tag set, False if it is not
    '''
    for name_to_tags_sets_id in VALID_METADATA_IDS:
        if int(tag_sets_id) in name_to_tags_sets_id.values():
            return True
    return False


def is_bad_theme(tag_id):
    '''
    Find out if a tag set is one used to hold metadata on a Source.
    :param tag_sets_id: the id of tag set
    :return: True if it is a valid metadata tag set, False if it is not
    '''

    if int(tag_id) in BAD_THEMES:
            return True
    return False


def format_name_from_label(user_label):
    formatted_name = re.sub('\W|^(?=\d)', '_', user_label)
    return formatted_name


def label_for_metadata_tag(tag):
    label = None
    tag_sets_id = tag['tag_sets_id']
    if tag_sets_id == TAG_SETS_ID_PUBLICATION_COUNTRY:
        label = tag['tag'][-3:]
    elif tag_sets_id == TAG_SETS_ID_PUBLICATION_STATE:
        label = tag['tag'][4:]
    elif tag_sets_id == TAG_SETS_ID_PRIMARY_LANGUAGE:
        label = tag['tag']
    elif tag_sets_id == TAG_SETS_ID_COUNTRY_OF_FOCUS:
        label = tag['tag']
    elif tag_sets_id == TAG_SETS_ID_MEDIA_TYPE:
        label = tag['tag']
    return label

static_tag_set_cache_dir = os.path.join(base_dir, 'server', 'static', 'data')


def tags_in_tag_set(mc_api_key, tag_sets_id):
    return tag_set_with_tags(mc_api_key, tag_sets_id, False, True)['tags']


def tag_set_with_tags(mc_api_key, tag_sets_id, only_public_tags=False, use_file_cache=False):
    local_mc = MediaCloud(mc_api_key)
    if use_file_cache:
        file_name = "tags_in_{}.json".format(tag_sets_id)
        file_path = os.path.join(static_tag_set_cache_dir, file_name)
        if os.path.isfile(file_path):
            return cached_tag_set_file(file_path)   # more caching!
    tag_set = local_mc.tagSet(tag_sets_id)
    # page through tags
    more_tags = True
    all_tags = []
    last_tags_id = 0
    while more_tags:
        tags = _cached_tag_page(mc_api_key, tag_set['tag_sets_id'], last_tags_id, 100, only_public_tags)
        all_tags = all_tags + tags
        if len(tags) > 0:
            last_tags_id = tags[-1]['tags_id']
        more_tags = len(tags) != 0
    tag_list = [t for t in all_tags if (only_public_tags is False) or
                (t['show_on_media'] is 1 or t['show_on_media'] is True)]  # double check the show_on_media because that controls public or not
    tag_list = sorted(tag_list, key=itemgetter('label'))
    tag_set['tags'] = tag_list
    tag_set['name'] = tag_set['label']  # for backwards compatability
    return tag_set


@cache.cache_on_arguments(function_key_generator=key_generator)
def _cached_tag_page(mc_api_key, tag_sets_id, last_tags_id, rows, public_only):
    local_mc = MediaCloud(mc_api_key)
    # user agnostic cache here, because it isn't user-dependent
    tag_list = local_mc.tagList(tag_sets_id=tag_sets_id, last_tags_id=last_tags_id, rows=rows, public_only=public_only)
    return tag_list


@cache.cache_on_arguments(function_key_generator=key_generator)
def cached_tag_set_file(file_path):
    # hold the file in memory to reduce reads
    with codecs.open(file_path, 'r', 'utf-8') as json_data:
        data = json.load(json_data)
        return data


def media_with_tag(user_mc_key, tags_id, cached=False):
    more_media = True
    all_media = []
    max_media_id = 0
    while more_media:
        logger.debug("last_media_id %s", str(max_media_id))
        if cached:
            media = cached_media_with_tag_page(tags_id, max_media_id)
        else:
            media = _media_with_tag_page(tags_id, max_media_id)
        all_media = all_media + media
        if len(media) > 0:
            max_media_id = media[len(media) - 1]['media_id']
        more_media = len(media) == 100
    return sorted(all_media, key=lambda t: t['name'].lower())


@cache.cache_on_arguments(function_key_generator=key_generator)
def cached_media_with_tag_page(tags_id, max_media_id):
    '''
    We have to do this on the page, not the full list because memcache has a 1MB cache upper limit,
    and some of the collections have TONS of sources
    Ok to be a cross-user cache here
    '''
    return _media_with_tag_page(tags_id, max_media_id)


def _media_with_tag_page(tags_id, max_media_id):
    user_mc = user_mediacloud_client()
    return user_mc.mediaList(tags_id=tags_id, last_media_id=max_media_id, rows=100)
