# Changelog for djot.js

## 0.2.5

  * HTML renderer: use a *single* variation selector in backlink (#65).
    Previously we had a doubled one.
  * Revert change in parsing code for links/images.
    (commit 1b5425c7ac175127288dc8412e06df23db20b89a). (See #46, #64.)
  * Attributes: put events on markers and spaces (new fix for #46).
    Otherwise this is lost in `strMatches`, when we have to treat
    this material as part of a reference or destination.
  * Normalize reference + footnote labels. Trim and collapse adjacent
    interior whitespace, including newlines, to a single space. This
    will allow implicit heading references to work even when headings
    span multiple lines (#63).
  * `getUniqueIdentifier`: improve regex for symbol replacement (#63).

## 0.2.4

  * Fix bug in parsing code for links/images (#46).
  * Fix buggy table caption parsing (#57).
  * Fix smart punctuation in pandoc output (#62).
  * Fix filters to not run twice (#61, kibigo!).
  * Add package-lock.json and yarn.lock to repository (#60).
  * Allow comment end with attribute end (gemmaro, #59).

## 0.2.3

* Support pandoc-types 1.23 JSON API (#54).
  Note that this will require use of pandoc >= 3 with djot.

## 0.2.2

* Lists: prioritize roman numerals over alpha when ambiguous (#38,
  Noah Hellman).
* Fix processing of backslash escapes in attributes (#49).
* Make sure we reparse unclosed block attributes, even whene not
  followed by blank line (#47).
* Ensure that table cell 'align' is always non-null (#41).
* Migrate all attributes from header to section (#43).
* Don't remove heading attributes completely when promoting the
  identifier to the enclosing section (#43).
* djot renderer:
  + Throw error if no renderer defined for a node (#48).
  + Render url and email nodes instead of ignoring silently (#48).
* HTML renderer:
  + Don't generate "text-align: undefined".
  + Use unicode instead of entities for smart punctuation in HTML (#50).
* Playground:
  + Disable "Source positions" by default, but always enable it
    for preview (Noah Hellman).
  + Respect sourcepos checkbox (Noah Hellman).
  + Make debounce dynamic. Make debounce ms proportional to
    length of text, so short documents update faster.
* Update README on event parser function (gemmaro).
* Fuzz tests: report string that caused failure.

## 0.2.1

* HTML renderer: insert blank dummy notes when there is no
  note defined for a reference (#36).
* HTML renderer: render footnotes that are only referenced from other
  notes (#37).
* Pandoc parser: correctly handle DefaultStyle, DefaultDelim (#34).
* Optimize parsing and HTML rendering.

## 0.2.0

* Initial public release.
