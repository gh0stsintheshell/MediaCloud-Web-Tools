import { FETCH_TOPIC_GEOCODED_STORY_COVERAGE } from '../../../../actions/topicActions';
import { createAsyncReducer } from '../../../../lib/reduxHelpers';

const geocodedStoryTotals = createAsyncReducer({
  initialState: {
    counts: {
      count: 0,
      total: 0,
    },
  },
  action: FETCH_TOPIC_GEOCODED_STORY_COVERAGE,
});

export default geocodedStoryTotals;
