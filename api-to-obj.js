var fs = require('fs');
var _ = require('underscore');
var Deferred = require('deferred');
var drequest = Deferred.promisify(require('request'));


function requestsWrapper(api, method, each) {

  function pathsFromResp(urlTemplate, resp) {
    var t = _.template(urlTemplate);
    return JSON.parse(resp).map(function(obj) {
      return t(obj);
    });
  }

  function saveResp(id, response) {
    api.apiRepr[id] = {
      content: response.headers['content-type'],
      statusCode: response.statusCode,
      body: response.body
    }
  }

  return function(prevDeferrer, path) {
    var nextDeferred = Deferred();
    api.started();

    (prevDeferrer || Deferred(1)).done(function(prevResponse) {
      Deferred.apply(null,
        (each ? pathsFromResp(path, prevResponse[0].body) : [path])
          .map(function(path) {
            var id = _.template('<%= m %> <%= p %>')({m: method, p: path}),
                req = drequest({ method: method, url: api.baseUrl + path });

            req.done(function(args) {
              saveResp(id, args[0]);
            });

            return req;
          })
      ).done(function() {
        nextDeferred.resolve.apply(null, arguments);
        api.saved();
      })
    });

    return {
      get: _.partial(requestsWrapper(api, 'GET'), nextDeferred.promise()),
      getEach: _.partial(requestsWrapper(api, 'GET', true), nextDeferred.promise())
    };
  }
}


function API(baseUrl) {
  if (! this instanceof API) {
    throw new Error('API class must be constructed with the `new` keyword.');
  }
  this.baseUrl = baseUrl;
  this.apiRepr = {};
  this._activeRequests = 0;
  this._done = Deferred();

  this.started = function() {
    this._activeRequests++;
  };

  this.saved = function() {
    if (! --this._activeRequests) {
      this._done.resolve(this.apiRepr);
    }
  }

  this.get = _.partial(requestsWrapper(this, 'GET'), null);

  this.done = function(fn) {
    this._done.promise().done(fn);
  }
}


module.exports = API;
