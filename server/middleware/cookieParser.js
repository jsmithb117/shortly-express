parseCookies = (req, res, next) => {
  if (req.headers.cookie !== undefined) {
    req.cookies = req.headers.cookie.replace((/[\=;]/gm), ',').split(',').reduce((parsedCookies, cookie, index, cookieArr) => {
      if (index % 2 === 0) {
        parsedCookies[cookie.trim()] = cookieArr[index + 1];
      }
      return parsedCookies;
    }, {});
  }
  next();
};

module.exports = parseCookies;