// Dependencies
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
            [p.substring(0, p.lastIndexOf(ext)), '-', privilege, '-', hash, ext].join('') : p;

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

    sitemap(files, metalsmith, opts.privilegesKey, opts.baseUrl);

    return process.nextTick(done)
  }
}

// Print the sitemap, to easily get the private urls
function sitemap(files, metalsmith, privilegesKey, baseUrl) {
  var metadata = metalsmith.metadata();

  // Build site map
  var privileges = Object.keys(metadata[privilegesKey]);
  var sitemap = privileges.map(function(privilege) {
    return '[' + privilege.bold + '] :\n  ' + Object.keys(metadata[privilegesKey][privilege]).map(function(p) {
      var name = metadata[privilegesKey][privilege][p].path;
      return p.bold + ' - ' + baseUrl + ['/', name.substring(0, name.lastIndexOf(path.extname(name))), '.html'].join('').green;
    }).join('\n  ');
  }).join('\n');

  console.log(('Sitemap ' + privilegesKey + ' :\n').bold.blue + sitemap);
}
