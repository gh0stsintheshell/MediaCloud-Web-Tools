import PropTypes from 'prop-types';
import React from 'react';
import { injectIntl, FormattedMessage } from 'react-intl';
import { connect } from 'react-redux';
import Modal from '@material-ui/core/Modal';
import DialogContent from '@material-ui/core/DialogContent';
import messages from '../../../resources/messages';
import PickedMediaContainer from './PickedMediaContainer';
import MediaPickerResultsContainer from './MediaPickerResultsContainer';
import { fetchMediaPickerFeaturedCollections, initializePreviouslySelectedMedia, clearSelectedMedia } from '../../../actions/systemActions';
import AppButton from '../AppButton';
import { AddQueryButton } from '../IconButton';
import { PICK_FEATURED } from '../../../lib/explorerUtil';
import { TAG_SET_MC_ID } from '../../../lib/tagUtil';

const localMessages = {
  title: { id: 'system.mediaPicker.select.title', defaultMessage: 'title' },
  intro: { id: 'system.mediaPicker.select.info',
    defaultMessage: '<p>This is an intro</p>' },
  helpTitle: { id: 'system.mediaPicker.select.help.title', defaultMessage: 'About Media' },
  selectMediaTitle: { id: 'system.mediaPicker.selectMediaTitle', defaultMessage: 'Select Media' },
  searchByName: { id: 'system.mediaPicker.select.searchby.name', defaultMessage: 'Search by Name/URL' },
  addMedia: { id: 'system.mediaPicker.select.addMedia', defaultMessage: 'Change/add media sources and collections' },
};

class MediaPickerDialog extends React.Component {
  state = {
    open: false,
  };

  componentWillMount() { // only called on intial parent load -eg not when dialog pops up
    if (this.state.open) {
      window.scrollTo(0, 0);
    }
  }

  componentWillReceiveProps(nextProps) {
    // select the media so we fill the reducer with the previously selected media
    const { initMedia, handleInitialSelectionOfMedia } = this.props;
    if (JSON.stringify(initMedia) !== JSON.stringify(nextProps.initMedia)) {
      if (nextProps.initMedia) { // expects an array of media from caller
        handleInitialSelectionOfMedia(nextProps.initMedia);
      }
    }
  }

  componentWillUnmount() {
    const { reset } = this.props;
    reset();
  }

  handleModifyClick = (initMedia) => {
    const { setQueryFormChildDialogOpen, handleInitialSelectionOfMedia } = this.props;
    this.setState({ open: true });
    handleInitialSelectionOfMedia(initMedia); // push into selectedMedia in store

    // document.body.style.overflow = 'hidden';
    if (setQueryFormChildDialogOpen) { // way to tell parent that a dialog is open - focus issue stuff
      setQueryFormChildDialogOpen(true);
    }
    // need to set body to overflow: hidden somehow...
  };

  handleRemoveDialogClose = (confirm) => {
    const { onConfirmSelection, selectedMedia, setQueryFormChildDialogOpen, reset } = this.props;
    this.setState({ open: false });
    if (confirm) {
      onConfirmSelection(selectedMedia); // passed in from containing element
    }
    reset();
    if (setQueryFormChildDialogOpen) {
      setQueryFormChildDialogOpen(false);
    }
  };

  render() {
    const { initMedia, selectedMedia, handleSelection, lookupTimestamp } = this.props;
    const { formatMessage } = this.props.intl;
    let modalContent = null;
    if (this.state.open) {
      modalContent = (
        <div>
          <Modal
            title={formatMessage(localMessages.selectMediaTitle)}
            open={this.state.open}
            onClose={() => this.handleRemoveDialogClose(false)}
          >
            <DialogContent className="select-media-dialog-wrapper">
              <div className="select-media-dialog-inner">
                <div className="select-media-sidebar">
                  <PickedMediaContainer selectedMedia={selectedMedia} />
                  <AppButton
                    className="select-media-ok-button"
                    label={formatMessage(messages.ok)}
                    onTouchTap={() => this.handleRemoveDialogClose(true)}
                    type="submit"
                    primary
                  />
                </div>
                <div className="select-media-content">
                  <MediaPickerResultsContainer timestamp={lookupTimestamp} selectedMediaQueryType={PICK_FEATURED} selectedMedia={selectedMedia} handleSelection={handleSelection} />
                </div>
              </div>
            </DialogContent>
          </Modal>
        </div>
      );
    }

    return (
      <div className="add-media">
        <AddQueryButton
          onClick={() => this.handleModifyClick(initMedia)}
          tooltip={formatMessage(localMessages.addMedia)}
        />
        {modalContent}
        <div className="add-media-label">
          <FormattedMessage {...localMessages.addMedia} />
        </div>
      </div>
    );
  }
}

MediaPickerDialog.propTypes = {
  // from context
  intl: PropTypes.object.isRequired,
  // from parent/implementer
  initMedia: PropTypes.array,
  selectedMedia: PropTypes.array,
  lookupTimestamp: PropTypes.string,
  handleSelection: PropTypes.func.isRequired,
  handleInitialSelectionOfMedia: PropTypes.func.isRequired,
  onConfirmSelection: PropTypes.func.isRequired,
  reset: PropTypes.func.isRequired,
  setQueryFormChildDialogOpen: PropTypes.func,
};

const mapStateToProps = state => ({
  fetchStatus: state.system.mediaPicker.selectMedia.fetchStatus,
  selectedMedia: state.system.mediaPicker.selectMedia.list, // initially empty
  lookupTimestamp: state.system.mediaPicker.featured.timestamp, // or maybe any of them? trying to get to receive new props when fetch succeeds
});

const mapDispatchToProps = dispatch => ({
  handleSelection: (values) => {
    if (values) {
      dispatch(fetchMediaPickerFeaturedCollections(TAG_SET_MC_ID));
    }
  },
  reset: () => {
    dispatch(clearSelectedMedia());
  },
  handleInitialSelectionOfMedia: (prevSelectedMedia) => {
    if (prevSelectedMedia) {
      dispatch(initializePreviouslySelectedMedia(prevSelectedMedia)); // disable button too
    }
  },
});

export default
injectIntl(
  connect(mapStateToProps, mapDispatchToProps)(
    MediaPickerDialog
  )
);
