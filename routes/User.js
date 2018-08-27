const Redis = require('ioredis')
const uuidv1 = require('uuid/v1')
const fetch = require('node-fetch')

const client = new Redis(6379, 'redis')
const userKey = 'users:'
const accountKey = 'account:'

module.exports = class User {
  constructor(username, fullname, email, walletId, accounts) {
    this.username = username
    this.fullname = fullname
    this.email = email
    this.walletId = walletId
    this.accounts = accounts ? accounts : []
    this.id = uuidv1()
  }
  saveUser(next) {
    const data = JSON.stringify({
      password: this.getWalletPassword()
    })
    const user = this
    fetch('http://naivecoin:3001/operator/wallets', {
      method: 'POST',
      body: data,
      headers:{
        'Content-Type': 'application/json',
        'accepts': 'application/json',
        'Cache-Control': 'no-store'
      }
    }).then(response => {
      if (!response.ok) {
        console.log("error returned from naivecoin " + response.statusText);
        throw Error(response.statusText);
      }
      return response.json()
    }).then(data => {
      user.walletId = data.id // save the wallet id for later
      client.set(userKey + user.username, JSON.stringify(user))
      return next(null);
    }).catch(err => {
      console.log('error returned from naivecoin ' + err)
      return next(err);
    })
  }
  static isValid(userId, next) {
    client.get(userKey + userId, (err, data) => {
      if(err) return next(err)
      if(!data) return next(null, null)
      data = JSON.parse(data)
      const user = new User(data.username, data.fullname, data.email, data.walletId, data.accounts)
      return next(null, user)
    })
  }
  static getAllUsers(next) {
    client.keys(userKey + '*', next)
  }
  getAccount(id, next) {
    const user = this
    client.get(accountKey+id, (err, account) => {
      if(err) return next(err)
      if(!account) return next('not found')
      account = JSON.parse(account)
      if(account.username != user.username) return next('not found')
      return next(null, account)
    })
  }
  saveAccount(next) {
    const user = this
    fetch('http://naivecoin:3001/operator/wallets/'+user.walletId+'/addresses', {
      method: 'POST',
      headers:{
        'password': user.getWalletPassword(),
        'Content-Type': 'application/json',
        'accepts': 'application/json',
        'Cache-Control': 'no-store'
      }
    }).then(response => {
      if (!response.ok) {
        console.log("error returned from naivecoin " + response.statusText);
        throw Error(response.statusText);
      }
      return response.json()
    }).then(data => {
      const account = {
        id: uuidv1(),
        username: user.username,
        addressId: data.address,
        balance: 0
      }
      user.accounts.push(account.id)
      client.set(userKey + user.username, JSON.stringify(user))
      client.set(accountKey + account.id, JSON.stringify(account))
      next(null, account)
    }).catch(err => {
      console.log('error returned from naivecoin ' + err);
      next(err);
    })
  }
  mine(account, next) {
    const user = this
    const data = JSON.stringify({
      rewardAddress: account.addressId
    })
    fetch('http://naivecoin:3001/miner/mine', {
      method: 'POST',
      body: data,
      headers:{
        'Content-Type': 'application/json',
        'accepts': 'application/json',
        'Cache-Control': 'no-store'
      }
    }).then(response => {
      if (!response.ok) {
        console.log('error returned from naivecoin ' + response.statusText);
        throw Error(response.statusText);
      }
      return response.json()
    }).then(data => {
      console.log('data mined : ' + JSON.stringify(data))
      user.setBalance(account, (err) => {
        if(err) return next(err)
        next(null, account)
      })
    }).catch(err => {
      console.log('error returned from naivecoin ' + err);
      next(err);
    })
  }
  transfer(fromAccount, toAccount, amount, next) {
    const user = this
    if(fromAccount.amount < amount) {
      return next('insufficient funds')
    }
    const data = JSON.stringify({
      fromAddress: fromAccount.addressId,
      toAddress: toAccount.addressId,
      amount: amount,
      changeAddress: fromAccount.addressId
    })
    fetch('http://naivecoin:3001/operator/wallets/'+user.walletId+'/transactions', {
      method: 'POST',
      body: data,
      headers:{
        'password': user.getWalletPassword(),
        'Content-Type': 'application/json',
        'accepts': 'application/json',
        'Cache-Control': 'no-store'
      }
    }).then(response => {
      if (!response.ok) {
        console.log("error returned from naivecoin " + response.statusText);
        throw Error(response.statusText);
      }
      return response.json()
    }).then(data => {
      user.setBalance(fromAccount, (err) => {
        if(err) return next(err)
        user.setBalance(toAccount, (err) => {
          if(err) return next(err)
          next(null, fromAccount)
        })
      })
    }).catch(err => {
      console.log('error returned from naivecoin ' + err);
      next(err);
    })
  }
  setBalance(account, next) {
    fetch('http://naivecoin:3001/operator/'+account.addressId+'/balance', {
      method: 'GET',
      headers:{
        'Content-Type': 'application/json',
        'accepts': 'application/json',
        'Cache-Control': 'no-store'
      }
    }).then(response => {
      if (!response.ok) {
        console.log('error returned from naivecoin ' + response.statusText);
        throw Error(response.statusText);
      }
      return response.json()
    }).then(data => {
      account.balance = data.balance
      console.log('setting balance on account ' + account.id + ' to ' + account.balance)
      client.set(accountKey + account.id, JSON.stringify(account))
      next(null)
    }).catch(err => {
      console.log('error returned from naivecoin ' + err);
      next(err);
    })

  }
  getWalletPassword() {// naive coin requires passwords with at least five words:
    return this.username + ' ' + this.email + ' ' + this.id + ' two more words'
  }
}
