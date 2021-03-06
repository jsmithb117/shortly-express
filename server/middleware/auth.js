const models = require('../models');
const Promise = require('bluebird');

module.exports.createSession = (req, res, next) => {
  console.log('create session');
  if (req.cookies && req.cookies.cookieName === 'invalidLink') {
    req['session'] = { invalidLink: true };
    res.clearCookie('invalidLink');
    next();
  }

  Promise.resolve(models.Sessions.create())
    .then((results) => {
      return models.Sessions.get({ id: results.insertId })
        .then((sessionInfo) => {
          return models.Users.get({ id: sessionInfo.id })
            .then((userInfo) => {
              if (userInfo !== undefined) {
                // req.cookies = req.cookies || sessionInfo.hash;
                req['session'] = { hash: sessionInfo.hash, userId: sessionInfo.id, user: { username: userInfo.username } };
                res['cookies'] = { 'shortlyid': { value: sessionInfo.hash } };
                res.cookie('cookieName', sessionInfo.hash, { maxAge: 900000, httpOnly: true });
                next();
              } else if (req.cookies !== undefined && req.cookies.shortlyid) {
                return models.Sessions.get({ hash: req.cookies.shortlyid })
                  .then((existingSession) => {
                    req['session'] = existingSession;
                    res['cookies'] = { 'shortlyid': { value: req.cookies.shortlyid } };
                    res.cookie('cookieName', sessionInfo.hash, { maxAge: 900000, httpOnly: true });
                    next();
                  });
              } else {
                req['session'] = { hash: sessionInfo.hash, userId: sessionInfo.id, user: null };
                res['cookies'] = { 'shortlyid': { value: sessionInfo.hash } };
                res.cookie('cookieName', sessionInfo.hash, { maxAge: 900000, httpOnly: true });
                next();
              }
            });
        });
    })
    .error((err) => {
      // console.error(err);
    })
    .catch((stuff) => {
      // console.log(stuff);
    });
};

/************************************************************/
// Add additional authentication middleware functions below
/************************************************************/

module.exports.verifySession = (req, res, next) => {
  console.log('verify session');

  var sessionIsVerified = models.Sessions.isLoggedIn(req.session) || req.session.invalidLink;

  if (!sessionIsVerified) {
    models.Sessions.delete({ hash: req.session.hash })
      .then(() => {
        res.redirect('/login');
      });
  } else {
    next();
  }
};
