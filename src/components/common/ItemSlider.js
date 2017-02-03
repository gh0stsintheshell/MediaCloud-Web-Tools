import React from 'react';
import { injectIntl } from 'react-intl';
import Slider from 'react-slick';

const ItemSlider = (props) => {
  const { slides } = props;
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
  };

  // use this if you have a prepped set of JSX tags to send over
  return (
    <Slider {...settings} style={{ width: 80, height: 100, margin: 10, padding: 10 }}>
      { slides }
    </Slider>
  );
};

ItemSlider.propTypes = {
  // from parent
  title: React.PropTypes.string.isRequired,
  intro: React.PropTypes.string,
  slides: React.PropTypes.array.isRequired,
  helpButton: React.PropTypes.node,
  // from dispatch
  handleClick: React.PropTypes.func,
  // from compositional chain
  intl: React.PropTypes.object.isRequired,
};

export default
  injectIntl(
    ItemSlider
  );