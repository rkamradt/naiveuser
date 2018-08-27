const express = require('express');
const logger = require('morgan');
const passport = require('passport')
const BearerStrategy = require('passport-http-bearer').Strategy
const fetch = require('node-fetch')

const indexRouter = require('./routes/index');
const User = require('./routes/User')

passport.use(new BearerStrategy(function(token, next) {
  console.log('checking on token ' + token)
  fetch('https://api.rlksr.com/oauth2/identity/'+token, {
    method: 'GET',
    headers:{
      'accepts': 'application/json',
      'Cache-Control': 'no-store'
    }
  }).then(response => {
    if (!response.ok) {
      console.log('token not ok')
      return next('not ok returned from oauth2server');
    }
    return response.json()
  }).then(data => {
    if(!data) { throw Error('data parsed to null') }
    User.isValid(data.id, (err, user) => {
      if(err) return next(err)
      const iuser = !user ? new User(data.id) : user;
      return next(null, iuser)
    })
  }).catch(err => {
    console.log('oauth2 error')
    return next(err)
  })

}))

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/', indexRouter);

module.exports = app;
