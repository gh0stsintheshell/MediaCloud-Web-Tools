import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import TextField from '@material-ui/core/TextField';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconMenu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import IconButton from '@material-ui/core/IconButton';
import ColorPicker from '../../common/ColorPicker';
import messages from '../../../resources/messages';

const localMessages = {
  searchHint: { id: 'explorer.querypicker.searchHint', defaultMessage: 'keywords' },
  register: { id: 'explorer.querypicker.register', defaultMessage: 'Register to Edit' },
};

class QueryPickerDemoHeader extends React.Component {
  sendToLink = () => {
    const registrationUrl = '/login';
    window.open(registrationUrl, '_blank');
  };
  render() {
    const { query, isLabelEditable, isDeletable, onColorChange, onDelete, handleMenuItemKeyDown, focusUsernameInputField } = this.props;
    const { formatMessage } = this.props.intl;
    let nameInfo = <div />;
    const isThisAProtectedQuery = query.searchId !== null && query.searchId !== undefined;
    /*
      in Logged-In mode, the user can click the icon button, and edit the label of the query or delete the query
    */
    let iconOptions = null;
    let menuRegister = null;
    let menuDelete = null;
    if (query) {
      if (!isThisAProtectedQuery) {
        menuRegister = <MenuItem onTouchTap={this.sendToLink}><FormattedMessage {...localMessages.register} /></MenuItem>;
      }
      if (!isThisAProtectedQuery && isDeletable()) { // can delete only if this is a custom query (vs sample query) for demo users and this is not the only QueryPickerItem
        menuDelete = <MenuItem onTouchTap={() => onDelete(query)}><FormattedMessage {...messages.delete} /></MenuItem>;
      }
      if (menuRegister !== null || menuDelete !== null) {
        iconOptions = (
          <div className="query-picker-icon-button">
            <IconMenu
              className="query-picker-icon-button"
              iconButtonElement={<IconButton><MoreVertIcon /></IconButton>}
              anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
              targetOrigin={{ horizontal: 'left', vertical: 'top' }}
            >
              {menuRegister}
              {menuDelete}
            </IconMenu>
          </div>
        );
      }
      const colorPickerContent = (
        <ColorPicker
          color={query.color}
          onChange={e => onColorChange(e.value)}
        />
      );
      if (isLabelEditable) { // determine whether the label is editable or not (demo or logged in)
        nameInfo = (
          <div>
            <div>
              {colorPickerContent}
              <TextField
                className="query-picker-editable-name"
                id={`query-${query.index}-q`}
                name="q"
                defaultValue={query.q}
                hintText={formatMessage(localMessages.searchHint)}
                onKeyPress={handleMenuItemKeyDown}
                ref={focusUsernameInputField}
              />
              {iconOptions}
            </div>
          </div>
        );
      } else {  // the labels are not editable when the Demo user views the sample searches
        nameInfo = (
          <div>
            {colorPickerContent}
            &nbsp;
            <span
              className="query-picker-name"
            >
              {query.label}
            </span>
            {iconOptions}
          </div>
        );
      }
    }
    return nameInfo;
  }
}
QueryPickerDemoHeader.propTypes = {
  // from parent
  query: PropTypes.object.isRequired,
  isLabelEditable: PropTypes.bool.isRequired,
  isDeletable: PropTypes.func.isRequired,
  onColorChange: PropTypes.func.isRequired,
  updateDemoQueryLabel: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  handleMenuItemKeyDown: PropTypes.func.isRequired,
  focusUsernameInputField: PropTypes.func.isRequired,
  // from composition
  intl: PropTypes.object.isRequired,
};


export default
  injectIntl(
    QueryPickerDemoHeader
  );
