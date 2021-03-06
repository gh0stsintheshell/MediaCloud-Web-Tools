import PropTypes from 'prop-types';
import React from 'react';
import { injectIntl, FormattedMessage } from 'react-intl';
import { connect } from 'react-redux';
import CollectionResultsTable from './CollectionResultsTable';
import MediaPickerSearchForm from '../MediaPickerSearchForm';
import { FETCH_ONGOING } from '../../../../lib/fetchConstants';
import LoadingSpinner from '../../LoadingSpinner';

const localMessages = {
  title: { id: 'system.mediaPicker.collections.title', defaultMessage: 'Collections matching "{name}"' },
  hintText: { id: 'system.mediaPicker.collections.hint', defaultMessage: 'Search for collections by name' },
  noResults: { id: 'system.mediaPicker.collections.noResults', defaultMessage: 'No results. Try searching for issues like online news, health, blogs, conservative to see if we have collections made up of those types of sources.' },
};


const CollectionSearchResultsContainer = (props) => {
  const { selectedMediaQueryKeyword, initCollections, collectionResults, onSearch, handleToggleAndSelectMedia, fetchStatus, hintTextMsg } = props;
  const { formatMessage } = props.intl;
  let content = null;
  if (fetchStatus === FETCH_ONGOING) {
    // we have to do this here to show a loading spinner when first searching (and featured collections are showing)
    content = <LoadingSpinner />;
  } else if (collectionResults && (collectionResults.list && selectedMediaQueryKeyword)) {
    content = (
      <CollectionResultsTable
        title={formatMessage(localMessages.title, { name: selectedMediaQueryKeyword })}
        collections={collectionResults.list}
        handleToggleAndSelectMedia={handleToggleAndSelectMedia}
      />
    );
  } else if (initCollections) {
    content = initCollections;
  } else {
    content = <FormattedMessage {...localMessages.noResults} />;
  }
  return (
    <div>
      <MediaPickerSearchForm
        initValues={{ storedKeyword: { mediaKeyword: selectedMediaQueryKeyword } }}
        onSearch={val => onSearch(val)}
        hintText={formatMessage(hintTextMsg || localMessages.hintText)}
      />
      {content}
    </div>
  );
};


CollectionSearchResultsContainer.propTypes = {
  // form compositional chain
  intl: PropTypes.object.isRequired,
  // from parent
  handleToggleAndSelectMedia: PropTypes.func.isRequired,
  whichTagSet: PropTypes.number,
  hintTextMsg: PropTypes.object,
  onSearch: PropTypes.func.isRequired,
  // from state
  selectedMediaQueryKeyword: PropTypes.string,
  selectedMediaQueryType: PropTypes.number,
  collectionResults: PropTypes.object,
  initCollections: PropTypes.object,
  fetchStatus: PropTypes.string,
};

export default
injectIntl(
  connect()(
    CollectionSearchResultsContainer
  )
);
