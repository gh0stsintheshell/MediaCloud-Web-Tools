import React from 'react';
import { injectIntl } from 'react-intl';
import { push } from 'react-router-redux';
import { connect } from 'react-redux';
import DataCard from './DataCard';
import SourceOrCollectionChip from './SourceOrCollectionChip';
import FilledStarIcon from './icons/FilledStarIcon';
import { isCollectionTagSet } from '../../lib/tagUtil';
import { DownloadButton } from '../common/IconButton';
import messages from '../../resources/messages';

const CollectionList = (props) => {
  const { title, intro, collections, handleClick, onDownload, helpButton } = props;
  const { formatMessage } = props.intl;
  const validCollections = collections.filter(c => (isCollectionTagSet(c.tag_sets_id) && c.show_on_media === 1));
  let actions = null;
  if (onDownload) {
    actions = (
      <div className="actions">
        <DownloadButton tooltip={formatMessage(messages.download)} onClick={onDownload} />
      </div>
    );
  }
  return (
    <DataCard className="collection-list">
      {actions}
      <h2>{title}{helpButton}</h2>
      <p>{intro}</p>
      <div className="collection-list-item-wrapper">
        {validCollections.map(c =>
          <SourceOrCollectionChip key={c.tags_id} object={c} onClick={() => handleClick(c.tags_id)}>
            { c.isFavorite ? <FilledStarIcon /> : '' }
          </SourceOrCollectionChip>
        )}
      </div>
    </DataCard>
  );
};

CollectionList.propTypes = {
  // from parent
  title: React.PropTypes.string.isRequired,
  intro: React.PropTypes.string,
  collections: React.PropTypes.array.isRequired,
  linkToFullUrl: React.PropTypes.bool,
  onDownload: React.PropTypes.func,
  helpButton: React.PropTypes.node,
  // from dispatch
  handleClick: React.PropTypes.func.isRequired,
  // from compositional chain
  intl: React.PropTypes.object.isRequired,
};

const mapDispatchToProps = (dispatch, ownProps) => ({
  handleClick: (collectionId) => {
    if (ownProps.linkToFullUrl) {
      window.open(`https://sources.mediacloud.org/#/collections/${collectionId}/details`);
    } else {
      dispatch(push(`/collections/${collectionId}`));
    }
  },
});

export default
  injectIntl(
    connect(null, mapDispatchToProps)(
      CollectionList
    )
  );
