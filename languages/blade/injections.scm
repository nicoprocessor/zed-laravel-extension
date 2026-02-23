((script_element
  (raw_text) @content)
 (#set! "language" "javascript"))

((style_element
  (raw_text) @content)
 (#set! "language" "css"))

((php_only) @content
 (#set! "language" "php_only"))

((parameter) @content
 (#set! "language" "php_only"))

((attribute
  (attribute_name) @_name
  (quoted_attribute_value
    (attribute_value) @content))
 (#eq? @_name "style")
 (#set! "language" "css"))

((attribute
  (attribute_name) @_name
  (quoted_attribute_value
    (attribute_value) @content))
 (#match? @_name "^(x-|wire:|@)")
 (#set! "language" "javascript"))
