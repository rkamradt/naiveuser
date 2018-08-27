const express = require('express')
const router = express.Router()
const User = require('./User')
const passport = require('passport')

const authenticate = passport.authenticate('bearer', { session: false })

const returnStatus = (res, err) => {
  console.log('in returnStatus err = ' + JSON.stringify(err))
  var code = 400
  if(err === "not found") code = 404
  if(err === "forbidden") code = 403
  if(err && err.toString().startsWith('error returned from naivecoin')) code = 502
  res.status(code).send(err)
}

/* GET list of users */
router.get('/users', authenticate, (req, res) => {
  User.getAllUsers((err, ids) => {
    if(err) return returnStatus(res, err)
    return res.send(ids)
  })
})
/* GET specific user */
router.get('/users/:user', authenticate, (req, res) => {
  if(req.user.username !== req.params.user) return res.status(403).send('Forbidden')
  User.isValid(req.params.user, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    user.id = ""
    return res.send(user)
  })
})
/* create new user */
router.post('/users', authenticate, (req, res) => {
  if(!req.body.username) return res.status(400).send('username is required')
  if(req.user.username !== req.body.username) return res.status(403).send('Forbidden')
  const user = new User(req.body.username,req.body.fullname,req.body.email)
  user.saveUser(err => {
    if(err) return returnStatus(res, err)
    user.id = ""
    res.status(201).send(user)
  })
})

/* GET list of accounts for a user */
router.get('/users/:user/accounts', authenticate, (req, res) => {
  if(req.user.username !== req.params.user) return res.status(403).send('Forbidden')
  User.isValid(req.params.user, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    res.send(user.accounts)
  })
})
/* GET specific account */
router.get('/users/:user/accounts/:id', authenticate, (req, res) => {
  if(req.user.username !== req.params.user) return res.status(403).send('Forbidden')
  User.isValid(req.params.user, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    user.getAccount(req.params.id, (err, account) => {
      if(err) return returnStatus(res, err)
      res.send(account)
    })
  })
})
/* create new account for a user */
router.post('/users/:user/accounts', authenticate, (req, res) => {
  if(req.user.username !== req.params.user) return res.status(403).send('Forbidden')
  User.isValid(req.params.user, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    user.saveAccount((err, account) => {
      if(err) return returnStatus(err)
      res.send(account)
    })
  })
})
/* mine some coin */
router.post('/users/:user/accounts/:id/mine', authenticate, (req, res) => {
  if(req.user.username !== req.params.user) return res.status(403).send('Forbidden')
  User.isValid(req.params.user, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    user.getAccount(req.params.id, (err, account) => {
      if(err) return returnStatus(res, err)
      user.mine(account, (err) => {
        if(err) return returnStatus(res, err)
        res.send(account)
      })
    })
  })
})

/* transfer some coin */
router.post('/users/:user/accounts/:id/transfer', authenticate, (req, res) => {
  if(req.user.username !== req.params.user) return res.status(403).send('Forbidden')
  if(!req.body.toAccount) return res.status(400).send('toAccount is required')
  if(!req.body.amount) return res.status(400).send('amount is required')
  User.isValid(req.params.user, (err, user) => {
    if(err) return returnStatus(res, err)
    if(!user) return res.status(404).send('user not found')
    user.getAccount(req.params.id, (err, account) => {
      if(err) return returnStatus(res, err)
      user.getAccount(req.body.toAccount, (err, toAccount) => {
        user.transfer(account, toAccount, req.body.amount, (err) => {
          if(err) return returnStatus(res, err)
          res.send(account)
        })
      })
    })
  })
})

module.exports = router
