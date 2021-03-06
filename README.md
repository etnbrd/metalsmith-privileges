# metalsmith-privileges

A plugin to allow several level of privileges for a statis site.

Based on given privileges for each file, it duplicates and filter files to generate several version of the same site.
Each non-public file is given a hash in its filename.

## Installation

    $ npm install metalsmith-privileges

## Usage

### In the page:

```
---
title: This page is private
privileges: private
---
```

You can use different handle to define the level of privileges, by configuring the `handle` option. `privileges` is the default.

All the links to local files will be updated to point to the privileged files.

### In the build

```js
var privileges = require('metalsmith-privileges');

metalsmith
  .use(privileges({
    // Select only files that match the pattern
    pattern: '*'
    // The handle to specify privileges in the frontmatter
    handle: 'privileges',
    // The default privilege to apply to pages
    defaultPrivilege: 'public',
    // The default key to store privileges in Metadata
    // The files are kept in two structures :
    // - an object named after privilegesKey
    // - an array named privilegesKey + 'Array'
    privilegesKey: 'privileges',
    // Sort the array holding the files
    sortBy = 'date';
    // Reverse the array holding the files
    reverse = false;
    // The default key to generate the hashes
    // /!\ You should specify this value with a unique key
    key: '____';
    // Specify the inclusions between levels
    // /!\ The default value for this option is empty
    includes: {
      // A public post should also appear in the private version, whereas the opposite is false
      'public': ['private'],
      'private': []
    }
    // Baseurl for generating the sitemap
    baseUrl: 'http://localhost:5656',
  }));
```

## In the template

You can gather all the posts from the current privilege, to build an index or a menu.

```js
// An array of all the posts from current privilege
var posts = Object.keys(privileges[privilege]).map(function(name) {
  return privileges[privilege][name];
});
```
