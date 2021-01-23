const express = require('express');
const path = require('path');
const utils = require('./lib/hashUtils');
const partials = require('express-partials');
const bodyParser = require('body-parser');
const Auth = require('./middleware/auth');
const models = require('./models');

const cookieParser = require('./middleware/cookieParser');
const app = express();

app.set('views', `${__dirname}/views`);
app.set('view engine', 'ejs');
app.use(partials());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.use(cookieParser);
app.use(Auth.createSession);

app.get('/login', (req, res, next) => {
  res.render('login');
});

// app.get('/signup')

app.get('/', Auth.verifySession,
  (req, res) => {
    res.render('index');
  });

app.get('/create', Auth.verifySession,
  (req, res) => {
    res.render('index');
  });

app.get('/links', Auth.verifySession,
  (req, res, next) => {
    models.Links.getAll()
      .then(links => {
        res.status(200).send(links);
      })
      .error(error => {
        res.status(500).send(error);
      });
  });

app.get('/signup', (req, res, next) => {
  res.render('signup');
});

// app.post('/create', (req, res, next) => {
//   console.log('postttt');
//   return res.sendStatus(200);
// });

app.post('/links',
  (req, res, next) => {
    console.log('req.body.url: ', req.body.url);
    var url = req.body.url;
    if (!models.Links.isValidUrl(url)) {
      // send back a 404 if link is not valid
      return res.sendStatus(404);
    }

    return models.Links.get({ url })
      .then(link => {
        console.log('got link?: ', link);
        if (link) {
          throw link;
        }
        console.log('getting url title', url);
        return models.Links.getUrlTitle(url);
      })
      .then(title => {
        console.log('title?: ', title);
        return models.Links.create({
          url: url,
          title: title,
          baseUrl: req.headers.origin
        });
      })
      .then(results => {
        console.log('results?: ', results);
        return models.Links.get({ id: results.insertId });
      })
      .then(link => {
        console.log('Another link: ', link);
        throw link;
      })
      .error(error => {
        console.log(error);
        res.status(500).send(error);
        next();
      })
      .catch(link => {
        console.log('caught link: ', link);
        res.status(200).send(link);
        next();
      });
  });
/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/login', (req, res, next) => {
  console.log('login');
  var username = req.body.username;
  var attempted = req.body.password;
  return models.Users.get({ username: username })
    .then((results) => {
      let stored = results.password;
      let salt = results.salt;
      return models.Users.compare(attempted, stored, salt);
    })
    .then((boolean) => {
      if (boolean) {
        console.log('successful login');
        res.redirect('/');
      } else {
        throw new Error('unsuccessful login');
      }
    })
    .catch((err) => {
      console.log('caught err---> ' + err);
      res.redirect('/login');
    });
});


app.post('/signup', (req, res, next) => {
  var username = req.body.username;
  var password = req.body.password;
  Promise.resolve(models.Users.get({ 'username': username }))
    .then((result) => {
      if (result !== undefined) {
        res.redirect('/signup');
      } else {
        return models.Users.create({ username, password })
          .then(() => {
            return models.Sessions.update({ hash: req.session.hash }, { userId: req.session.userId })
              .then(() => {
                res.redirect('/');
              });
          })
          .error(err => {
            throw new Error(err);
          })
          .catch((err) => {
            res.redirect('/signup');
          });
      }
    });
});


app.get('/logout', (req, res, next) => {
  return models.Sessions.delete({ hash: req.cookies.cookieName })
    .then(() => {
      req.cookies = null;
      res.redirect('/');
    })
    .error((error) => {
      throw new Error(error);
    })
    .catch((error) => {
      res.redirect('/login');
    });
});

/************************************************************/
// Handle the code parameter route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/:code', (req, res, next) => {
  console.log('routes');
  return models.Links.get({ code: req.params.code })
    .tap(link => {
      if (!link) {
        console.log('error link ', link);
        throw new Error('Link does not exist');
      }
      console.log('models.Clicks.create');
      return models.Clicks.create({ linkId: link.id });
    })
    .tap(link => {
      console.log('incrementing visits-> ' + JSON.stringify(link));
      var visits = link.visits + 1;
      console.log('visits: ', visits);
      // return models.Links.update({visits: link.visits}, {visits: visits});
      return models.Links.update({visits: link.visits}, {visits: visits});
    })
    .then(({ url }) => {
      res.redirect(url);
    })
    .error(error => {
      res.status(500).send(error);
    })
    .catch((error) => {
      // console.log(error);
      res.cookie('cookieName', 'invalidLink', {maxAge: 3000, httpOnly: true});
      res.redirect('/');
    });
});

module.exports = app;