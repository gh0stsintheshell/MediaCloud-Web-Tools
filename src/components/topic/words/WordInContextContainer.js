import React from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { fetchWordSampleSentences } from '../../../actions/topicActions';
import composeHelpfulContainer from '../../common/HelpfulContainer';
import composeAsyncContainer from '../../common/AsyncContainer';
import DataCard from '../../common/DataCard';
import WordTree from '../../vis/WordTree';
import messages from '../../../resources/messages';
import { downloadSvg } from '../../util/svg';
import { DownloadButton } from '../../common/IconButton';

const localMessages = {
  title: { id: 'word.inContext.title', defaultMessage: 'Word in Context' },
  helpTitle: { id: 'word.inContext.help.title', defaultMessage: 'About Word in Context' },
  helpText: { id: 'word.inContext.help.text',
    defaultMessage: '<p>It is helpful to look at how a word is used, in addition to the fact that it is used.  While a word cloud can tell you what words are used, this interactive visualization can help you explore the use of a word in context.</p>',
  },
};

class WordInContextContainer extends React.Component {
  state = {
    imageUri: null,
  }
  componentWillReceiveProps(nextProps) {
    const { fetchData, filters } = this.props;
    if (nextProps.filters.timespanId !== filters.timespanId ||
      (nextProps.stem !== this.props.stem)) {
      fetchData(nextProps);
    }
  }
  getUniqueDomId = () => {
    const { topicId } = this.props;
    return `word-in-context-${topicId}`;
  }
  downloadSvg = () => {
    const svgNode = document.getElementById(this.getUniqueDomId()).children[0].children[0].children[0].children[0];
    downloadSvg(svgNode);
  }
  render() {
    const { term, sentences, helpButton } = this.props;
    const { formatMessage } = this.props.intl;
    const uniqueDomId = this.getUniqueDomId();
    return (
      <DataCard>
        <div className="actions">
          <DownloadButton tooltip={formatMessage(messages.downloadSVG)} onClick={() => this.downloadSvg()} />
        </div>
        <h2>
          <FormattedMessage {...localMessages.title} />
          {helpButton}
        </h2>
        <WordTree
          domId={uniqueDomId}
          sentences={sentences}
          startWord={term}
          height="400px"
        />
      </DataCard>
    );
  }
}

WordInContextContainer.propTypes = {
  // from parent
  stem: React.PropTypes.string.isRequired,
  term: React.PropTypes.string.isRequired,
  topicId: React.PropTypes.number.isRequired,
  filters: React.PropTypes.object.isRequired,
  // from store
  sentences: React.PropTypes.array.isRequired,
  // from dispatch
  fetchData: React.PropTypes.func.isRequired,
  // from context
  intl: React.PropTypes.object.isRequired,
  helpButton: React.PropTypes.node.isRequired,
};


const mapStateToProps = state => ({
  fetchStatus: state.topics.selected.word.sampleSentences.fetchStatus,
  sentences: state.topics.selected.word.sampleSentences.sentences,
});

const mapDispatchToProps = (dispatch, ownProps) => ({
  fetchData: (props) => {
    dispatch(fetchWordSampleSentences(props.topicId, props.stem, props.filters));
  },
  asyncFetch: () => {
    dispatch(fetchWordSampleSentences(ownProps.topicId, ownProps.stem, ownProps.filters));
  },
});

export default
  injectIntl(
    connect(mapStateToProps, mapDispatchToProps)(
      composeHelpfulContainer(localMessages.helpTitle, [localMessages.helpText, messages.wordTreeHelpText])(
        composeAsyncContainer(
          WordInContextContainer
        )
      )
    )
  );

