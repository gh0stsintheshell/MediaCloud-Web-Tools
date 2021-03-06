import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import messages from '../../resources/messages';
import { storyPubDateToTimestamp } from '../../lib/dateUtil';
import { googleFavIconUrl, storyDomainName } from '../../lib/urlUtil';
import { trimToMaxLength } from '../../lib/stringUtil';

const localMessages = {
  undateable: { id: 'story.publishDate.undateable', defaultMessage: 'Undateable' },
  foci: { id: 'story.foci.list', defaultMessage: 'List of Subtopics {list}' },
};

const StoryTable = (props) => {
  const { stories, maxTitleLength, onChangeFocusSelection, selectedStory, extraColumns, extraHeaderColumns } = props;
  const { formatMessage, formatDate } = props.intl;
  return (
    <div className="story-table">
      <table>
        <tbody>
          <tr>
            <th><FormattedMessage {...messages.storyTitle} /></th>
            <th colSpan="2"><FormattedMessage {...messages.media} /></th>
            <th><FormattedMessage {...messages.storyDate} /></th>
            { extraHeaderColumns && extraHeaderColumns()}
          </tr>
          {stories.map((story, idx) => {
            const domain = storyDomainName(story);
            let dateToShow = null; // need to handle undateable stories
            let dateStyle = '';
            const title = maxTitleLength !== undefined ? `${trimToMaxLength(story.title, maxTitleLength)}` : story.title;
            const isSelected = selectedStory === story.stories_id ? ' selected' : ' ';
            if (story.publish_date === 'undateable') {
              dateToShow = formatMessage(localMessages.undateable);
              dateStyle = 'story-date-undateable';
            } else {
              dateToShow = formatDate(storyPubDateToTimestamp(story.publish_date));
              dateStyle = (story.date_is_reliable === 0) ? 'story-date-unreliable' : 'story-date-reliable';
              if (story.date_is_reliable === 0) {
                dateToShow += '?';
              }
            }
            return (
              <tr key={`${story.stories_id}${idx}`} className={(idx % 2 === 0) ? `even${isSelected}` : `odd${isSelected}`}>
                <td>
                  <a tabIndex="0" role="button" href="#" onClick={() => onChangeFocusSelection(story)}>{title}</a>
                </td>
                <td>
                  <a href={story.media_url} rel="noopener noreferrer" target="_blank">
                    <img className="google-icon" src={googleFavIconUrl(domain)} alt={domain} />
                  </a>
                </td>
                <td>
                  <a href={story.media_url} rel="noopener noreferrer" target="_blank">{story.media_name}</a>
                </td>
                <td><span className={`story-date ${dateStyle}`}>{dateToShow}</span></td>
                {extraColumns && extraColumns(story, idx)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

StoryTable.propTypes = {
  stories: PropTypes.array.isRequired,
  intl: PropTypes.object.isRequired,
  onChangeFocusSelection: PropTypes.func,
  extraColumns: PropTypes.func,
  extraHeaderColumns: PropTypes.object,
  sortedBy: PropTypes.string,
  maxTitleLength: PropTypes.number,
  selectedStory: PropTypes.number,
};

export default injectIntl(StoryTable);
