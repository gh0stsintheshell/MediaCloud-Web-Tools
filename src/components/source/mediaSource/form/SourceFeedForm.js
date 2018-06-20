import PropTypes from 'prop-types';
import React from 'react';
import { Field, reduxForm } from 'redux-form';
import { FormattedMessage, injectIntl } from 'react-intl';
import { Row, Col } from 'react-flexbox-grid/lib';
import MenuItem from 'material-ui/MenuItem';
import withIntlForm from '../../../common/hocs/IntlForm';
import AppButton from '../../../common/AppButton';
import { emptyString, invalidUrl } from '../../../../lib/formValidators';
import messages from '../../../../resources/messages';

const localMessages = {
  typeSyndicated: { id: 'source.feed.add.type.syndicated', defaultMessage: 'Syndicated' },
  typeWebPage: { id: 'source.feed.add.type.webpage', defaultMessage: 'Web Page' },
  statusActive: { id: 'source.feed.add.status.active', defaultMessage: 'Active' },
  statusDisabled: { id: 'source.feed.add.status.inactive', defaultMessage: 'Disabled' },
  urlInvalid: { id: 'source.feed.url.invalid', defaultMessage: 'That isn\'t a valid feed URL. Please enter just the full url of one RSS or Atom feed.' },
};

const SourceFeedForm = (props) => {
  const { renderTextField, renderSelectField, buttonLabel, handleSubmit, onSave, pristine, submitting } = props;
  const { formatMessage } = props.intl;
  return (
    <form className="app-form source-feed-form" name="sourceFeedForm" onSubmit={handleSubmit(onSave.bind(this))}>
      <Row>
        <Col md={2}>
          <span className="label unlabeled-field-label">
            <FormattedMessage {...messages.feedName} />
          </span>
        </Col>
        <Col md={8}>
          <Field
            name="name"
            component={renderTextField}
            fullWidth
          />
        </Col>
      </Row>
      <Row>
        <Col md={2}>
          <span className="label unlabeled-field-label">
            <FormattedMessage {...messages.feedUrl} />
          </span>
        </Col>
        <Col md={8}>
          <Field
            name="url"
            component={renderTextField}
            fullWidth
          />
        </Col>
      </Row>
      <Row>
        <Col md={2}>
          <span className="label unlabeled-field-label">
            <FormattedMessage {...messages.feedType} />
          </span>
        </Col>
        <Col md={8}>
          <Field name="feed_type" component={renderSelectField} >
            <MenuItem key="syndicated" value="syndicated" primaryText={formatMessage(localMessages.typeSyndicated)} />
            <MenuItem key="web_page" value="web_page" primaryText={formatMessage(localMessages.typeWebPage)} />
          </Field>
        </Col>
      </Row>
      <Row>
        <Col md={2}>
          <span className="label unlabeled-field-label">
            <FormattedMessage {...messages.feedStatus} />
          </span>
        </Col>
        <Col md={8}>
          <Field name="binaryFeedStatus" value="active" component={renderSelectField} >
            <MenuItem value="active" primaryText={formatMessage(localMessages.statusActive)} />
            <MenuItem value="disabled" primaryText={formatMessage(localMessages.statusDisabled)} />
          </Field>
        </Col>
      </Row>
      <AppButton
        className="source-feed-updated"
        type="submit"
        label={buttonLabel}
        primary
        disabled={pristine || submitting}
      />
    </form>
  );
};

SourceFeedForm.propTypes = {
  // from compositional chain
  intl: PropTypes.object.isRequired,
  renderTextField: PropTypes.func.isRequired,
  renderSelectField: PropTypes.func.isRequired,
  initialValues: PropTypes.object,
  handleSubmit: PropTypes.func,
  pristine: PropTypes.bool.isRequired,
  submitting: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
  buttonLabel: PropTypes.string.isRequired,
};

function validate(values) {
  const errors = {};
  if (emptyString(values.binaryFeedStatus)) {
    errors.feed_status = messages.required;
  }
  if (emptyString(values.feed_type)) {
    errors.feed_type = messages.required;
  }
  if (emptyString(values.url)) {
    errors.url = messages.required;
  }
  if (invalidUrl(values.url)) {
    errors.url = localMessages.urlInvalid;
  }
  return errors;
}

const reduxFormConfig = {
  form: 'sourceFeedForm',
  validate,
};

export default
  injectIntl(
    withIntlForm(
      reduxForm(reduxFormConfig)(
        SourceFeedForm
      )
    )
  );
