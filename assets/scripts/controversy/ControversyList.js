import React from 'react';
import Table from 'material-ui/lib/table/table';
import TableHeaderColumn from 'material-ui/lib/table/table-header-column';
import TableRow from 'material-ui/lib/table/table-row';
import TableHeader from 'material-ui/lib/table/table-header';
import TableRowColumn from 'material-ui/lib/table/table-row-column';
import TableBody from 'material-ui/lib/table/table-body';
import { FormattedMessage, injectIntl } from 'react-intl';

const messages = {
  colHeadName: { id: 'controversies.table.name', defaultMessage: 'name' },
  colHeadDescription: { id: 'controversies.table.description', defaultMessage: 'Description' }
};

class ControversyListItem extends React.Component {
  getStyles() {
    const styles = {
      nameColumn: {
        width: '20%'
      }
    };
    return styles;
  }
  render() {
    const { controversy } = this.props;
    const styles = this.getStyles();
    return (
      <TableRow>
        <TableRowColumn styles={styles.nameColumn}>{controversy.name}</TableRowColumn>
        <TableRowColumn>{controversy.description}</TableRowColumn>
      </TableRow>
    );
  }
}

ControversyListItem.propTypes = {
  controversy: React.PropTypes.object.isRequired
};

const ControversyList = (props) => {
  const { formatMessage } = props.intl;
  const titleHandler = parentTitle => `${formatMessage(messages.homeTitle)} | ${parentTitle}`;
  return (
    <Table>
      <TableHeader displaySelectAll={false} adjustForCheckbox={false}>
        <TableRow>
          <TableHeaderColumn>Name</TableHeaderColumn>
          <TableHeaderColumn>Description</TableHeaderColumn>
        </TableRow>
      </TableHeader>
      <TableBody displayRowCheckbox={false}>
        {props.controversies.map((controversy) => {
          return <ControversyListItem key={controversy.controversies_id} controversy={controversy} />;
        })}
      </TableBody>
    </Table>);
};

ControversyList.propTypes = {
  controversies: React.PropTypes.array.isRequired,
  intl: React.PropTypes.object.isRequired
};

export default injectIntl(ControversyList);
