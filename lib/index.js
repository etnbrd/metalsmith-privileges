// Dependencies
var cheerio = require('cheerio');
var crypto = require('crypto');
var multimatch = require('multimatch');
var path = require('path');
var debug = require('debug')('metalsmith-privileges');
var colors = require('colors');

// Const
const key = '____';
const publicPrivilege = 'public';

// Export
module.exports = plugin

function plugin(opts) {

  // Populate options with defaults
  opts = opts || {};
  opts.defaultPrivilege = opts.defaultPrivilege || publicPrivilege;
  opts.privilegesKey = opts.privilegesKey || 'privileges';
  opts.baseUrl = opts.baseUrl || 'http://localhost:5656';
  opts.sortBy = opts.sortBy || 'date';
  opts.reverse = opts.reverse || false;
  opts.key = opts.key || key;

  return function (files, metalsmith, done) {

    // Get metadata and set a fingerprint key
    var metadata = metalsmith.metadata()
    metadata[opts.privilegesKey] =  metadata[opts.privilegesKey] || {};

    Object.keys(files)
    .filter(function (p) {
      // Filter by the pattern option
      return multimatch(p, opts.pattern).length > 0
    })
    .forEach(function (p) {
      // Parse privileges
      files[p].privileges = (files[p].privileges || opts.defaultPrivilege)
      .replace(/ /g, '')
      .split(',');

      // Merge privileges into a Set of unique privilege to iterate other
      var privileges = new Set();
      files[p].privileges.forEach(function(privilege) {
        privileges.add(privilege);
        opts.includes[privilege].forEach(function(_incl) {
          privileges.add(_incl);
        })
      })
      files[p].privileges = Array.from(privileges);

      debug('%s has privileges : ', p, files[p].privileges);
      files[p].privileges.forEach(function(privilege) {

        // Generate hash from file contents
        var hash = crypto.createHmac('md5', opts.key + privilege).update(p).digest('hex');

        // Get file extension
        var ext = path.extname(p);

        // Build fingerprinted filename if special privilege, otherwise keep it as is.
        var hashFilename = (privilege != opts.defaultPrivilege) ?
          [p.substring(0, p.lastIndexOf(ext)), '-', hash, ext].join('') : p;
          // [p.substring(0, p.lastIndexOf(ext)), '-', privilege, '-', hash, ext].join('') : p;

        // Duplicate the file with the new hashFilename to the list of files;
        debug('duplicating file %s into %s', p, hashFilename);
        files[hashFilename] = Object.assign({}, files[p], {
          path: hashFilename,
          privilege: privilege,
        });

        // Add hashFilename to correct privileges in metadata
        metadata[opts.privilegesKey][privilege] = metadata[opts.privilegesKey][privilege] || {};
        metadata[opts.privilegesKey][privilege][p] = files[hashFilename];
      })

      // Remove original, unless default privilege (public) applies
      if (files[p].privileges.indexOf(publicPrivilege) < 0) {
        debug('deleting %s', p);
        delete files[p];
      }
    })

    parseLinks(files, metalsmith, opts.privilegesKey);

    toArray(metalsmith, opts.privilegesKey, opts.sortBy, opts.reverse);

    sitemap(files, metalsmith, opts.privilegesKey, opts.baseUrl);

    return process.nextTick(done)
  }
}

function sorter(sort) {
  return function(a, b){
    a = a[sort];
    b = b[sort];
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    if (b > a) return -1;
    if (a > b) return 1;
    return 0;
  }
}

// Transform local links into their privilege counterpart
function parseLinks(files, metalsmith, privilegesKey) {
  var metadata = metalsmith.metadata();

  // For each level of privilege
  Object.keys(metadata[privilegesKey]).forEach(function(privilege) {
    // For each post in this level of privilege
    Object.keys(metadata[privilegesKey][privilege]).forEach(function(p) {
      // Parse the content of the post to simulate a DOM
      const $ = cheerio.load("" + metadata[privilegesKey][privilege][p].contents);

      // Find all the local link
      var links = $('a[href^="/"]');

      // Replace their href with the privileged path
      links.each(function(i, link) {
        var id = link.attribs.href.substring(1);

        if (metadata[privilegesKey][privilege] && metadata[privilegesKey][privilege][id]) {
          link.attribs.href = '/' + metadata[privilegesKey][privilege][id].path;
        }
      })

      // Push the content back to the metadata
      if (links.length > 0) {
        metadata[privilegesKey][privilege][p].contents = Buffer.from($.html());
      }
    });
  });

}

// Transform the privilege metadata object into an array
function toArray(metalsmith, privilegesKey, sortBy, reverse) {
  var metadata = metalsmith.metadata();
  var sort = 'function' == typeof sortBy ? sortBy : sorter(sortBy);

  Object.keys(metadata[privilegesKey]).map(function(privilege) {
    metadata[privilegesKey + 'Array'] = metadata[privilegesKey + 'Array'] || {};
    metadata[privilegesKey + 'Array'][privilege] = Object.keys(metadata[privilegesKey][privilege]).map(function(name) {
      return metadata[privilegesKey][privilege][name];
    }).sort(sort)

    if (reverse) metadata[privilegesKey + 'Array'][privilege].reverse();
  })
}

// Print the sitemap, to easily get the private urls
function sitemap(files, metalsmith, privilegesKey, baseUrl) {
  var metadata = metalsmith.metadata();

  // Build site map
  var sitemap = Object.keys(metadata[privilegesKey]).map(function(privilege) {
    return '[' + privilege.bold + '] :\n  ' + Object.keys(metadata[privilegesKey][privilege]).map(function(p) {
      var name = metadata[privilegesKey][privilege][p].path;
      return p.bold + ' - ' + baseUrl + ['/', name.substring(0, name.lastIndexOf(path.extname(name))), '.html'].join('').green;
    }).join('\n  ');
  }).join('\n');

  console.log(('Sitemap ' + privilegesKey.bold + ' :\n').blue + sitemap);
}
