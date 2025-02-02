import React, {PropTypes} from 'react';
import shouldPureComponentUpdate from 'react-pure-render/function';
import {Button} from 'react-bootstrap';

export default class ImageUploader extends React.Component {

  static PropTypes = {
    onUploadButtonClick: PropTypes.func.isRequired,
    style: PropTypes.prop
  };

  shouldComponentUpdate = shouldPureComponentUpdate;

  render() {

    const {style, className} = this.props;

    return (
      <div style={style} className={className}>
        <div className="upload-wrap">
          <div className="upload-info">
            <h1>This page has no attached image.</h1>
            <Button className="button-image-uploader" bsStyle="warning" onClick={this.props.onUploadButtonClick}>
              <i className="glyphicon glyphicon-open"></i>
              <span>Upload Image</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
