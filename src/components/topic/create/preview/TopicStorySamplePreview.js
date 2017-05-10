import React from 'react';
import { injectIntl, FormattedMessage } from 'react-intl';
import { connect } from 'react-redux';
import { push } from 'react-router-redux';
import composeDescribedDataCard from '../../../common/DescribedDataCard';
import composeAsyncContainer from '../../../common/AsyncContainer';
import StoryTable from '../../StoryTable';
import { fetchStorySampleByQuery } from '../../../../actions/topicActions';
import DataCard from '../../../common/DataCard';
import messages from '../../../../resources/messages';
import { filteredLocation } from '../../../util/location';

const NUM_TO_SHOW = 20;

// TODO check all these messages

const localMessages = {
  title: { id: 'topic.create.preview.stories.title', defaultMessage: 'Story Samples' },
  helpTitle: { id: 'topic.create.preview.stories.help.title', defaultMessage: 'About Story Samples' },
  helpText: { id: 'topic.create.preview.stories.help.text',
    defaultMessage: '<p>This chart shows you estimated coverage of your seed query</p>',
  },
  descriptionIntro: { id: 'topic.summary.stories.help.title', defaultMessage: 'This is a random sample of stories. We recommend that at least 90% of the stories you see here should be the type of story you desire. Any less than that and you are unlikely to get good results. If not enough stories match, consider adding more of the top words shown above to narrow in on the stuff you care about.' },

};

class TopicStorySamplePreview extends React.Component {
  componentWillReceiveProps(nextProps) {
    const { fetchData, query } = this.props;
    if (nextProps.query !== query) {
      fetchData(nextProps.query);
    }
  }
  render() {
    const { stories, handleStorySelection } = this.props;
    return (
      <DataCard>
        <h2>
          <FormattedMessage {...localMessages.title} />
        </h2>
        <StoryTable
          stories={stories}
          onChangeFocusSelection={handleStorySelection}
          maxTitleLength={50}
        />
      </DataCard>
    );
  }
}

TopicStorySamplePreview.propTypes = {
  // from composition chain
  intl: React.PropTypes.object.isRequired,
  // passed in
  query: React.PropTypes.object.isRequired,
  // from state
  fetchStatus: React.PropTypes.string.isRequired,
  total: React.PropTypes.number,
  stories: React.PropTypes.array,
  // from dispath
  asyncFetch: React.PropTypes.func.isRequired,
  fetchData: React.PropTypes.func.isRequired,
  handleStorySelection: React.PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  fetchStatus: state.topics.create.preview.matchingStories.fetchStatus,
  sort: state.topics.create.preview.matchingStories.total,
  stories: state.topics.create.preview.matchingStories.list,
});

const mapDispatchToProps = (dispatch, ownProps) => ({
  fetchData: (query) => {
    const infoForQuery = {
      q: query.solr_seed_query,
      start_date: query.start_date,
      end_date: query.end_date,
      limit: NUM_TO_SHOW,
    };
    infoForQuery['collections[]'] = [];
    infoForQuery['sources[]'] = [];

    if ('sourcesAndCollections' in query) {  // in FieldArrays on the form
      infoForQuery['collections[]'] = query.sourcesAndCollections.map(s => s.tags_id);
      infoForQuery['sources[]'] = query.sourcesAndCollections.map(s => s.media_id);
    }
    dispatch(fetchStorySampleByQuery(infoForQuery));
  },
  handleStorySelection: () => {
    // TODO get target, push that link
    const params = {
      ...ownProps.filters,
    };
    const newLocation = filteredLocation(ownProps.location, params);
    dispatch(push(newLocation));
  },
});

function mergeProps(stateProps, dispatchProps, ownProps) {
  return Object.assign({}, stateProps, dispatchProps, ownProps, {
    asyncFetch: () => {
      dispatchProps.fetchData(ownProps.query);
    },
  });
}

export default
  injectIntl(
    connect(mapStateToProps, mapDispatchToProps, mergeProps)(
      composeDescribedDataCard(localMessages.descriptionIntro, [messages.storiesTableHelpText])(
        composeAsyncContainer(
          TopicStorySamplePreview
        )
      )
    )
  );
