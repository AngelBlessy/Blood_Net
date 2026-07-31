const mongoose = require('mongoose');

// Shared GeoJSON Point sub-schema for 2dsphere-indexed location fields.
// Coordinates are [lng, lat] per GeoJSON convention (not [lat, lng]).
// Always set as a whole object ({type:'Point', coordinates:[lng,lat]}) or left
// entirely undefined — never partially, since a Point with no coordinates is
// invalid GeoJSON and would break the 2dsphere index.
const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2,
        message: 'coordinates must be [lng, lat]',
      },
    },
  },
  { _id: false }
);

module.exports = { geoPointSchema };
