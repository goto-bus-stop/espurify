var espurify = require('..');
var esprima = require('esprima');
var acorn = require('acorn');
var estraverse = require('estraverse');
var babelTypes = require('babel-types');
var babylon = require('babylon');
var fs = require('fs');
var path = require('path');
var syntax = estraverse.Syntax;
var assert = require('assert');

describe('eliminate extra properties from AST output', function () {
  beforeEach(function () {
    this.expected = {
      type: 'Program',
      sourceType: 'script',
      body: [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'CallExpression',
            callee: {
              type: 'Identifier',
              name: 'assert'
            },
            arguments: [
              {
                type: 'Literal',
                value: 'foo'
              }
            ]
          }
        }
      ]
    };
  });

  it('eliminate tokens and raw', function () {
    var ast = esprima.parse('assert("foo")', {tolerant: true, tokens: true, raw: true});
    var purified = espurify(ast);

    assert.deepEqual(ast, {
      type: 'Program',
      sourceType: 'script',
      body: [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'CallExpression',
            callee: {
              type: 'Identifier',
              name: 'assert'
            },
            arguments: [
              {
                type: 'Literal',
                value: 'foo',
                raw: '"foo"'
              }
            ]
          }
        }
      ],
      tokens: [
        {
          type: 'Identifier',
          value: 'assert'
        },
        {
          type: 'Punctuator',
          value: '('
        },
        {
          type: 'String',
          value: '"foo"'
        },
        {
          type: 'Punctuator',
          value: ')'
        }
      ],
      errors: []
    });

    assert.deepEqual(purified, this.expected);
  });

  it('eliminate range', function () {
    var ast = esprima.parse('assert("foo")', {tolerant: true, range: true});
    var purified = espurify(ast);
    assert.deepEqual(ast, {
      type: 'Program',
      sourceType: 'script',
      body: [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'CallExpression',
            callee: {
              type: 'Identifier',
              name: 'assert',
              range: [
                0,
                6
              ]
            },
            arguments: [
              {
                type: 'Literal',
                value: 'foo',
                raw: '"foo"',
                range: [
                  7,
                  12
                ]
              }
            ],
            range: [
              0,
              13
            ]
          },
          range: [
            0,
            13
          ]
        }
      ],
      range: [
        0,
        13
      ],
      errors: []
    });
    assert.deepEqual(purified, this.expected);
  });

  it('eliminate loc', function () {
    var ast = esprima.parse('assert("foo")', {tolerant: true, loc: true});
    var purified = espurify(ast);

    assert.deepEqual(ast, {
      type: 'Program',
      sourceType: 'script',
      body: [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'CallExpression',
            callee: {
              type: 'Identifier',
              name: 'assert',
              loc: {
                start: {
                  line: 1,
                  column: 0
                },
                end: {
                  line: 1,
                  column: 6
                }
              }
            },
            arguments: [
              {
                type: 'Literal',
                value: 'foo',
                raw: '"foo"',
                loc: {
                  start: {
                    line: 1,
                    column: 7
                  },
                  end: {
                    line: 1,
                    column: 12
                  }
                }
              }
            ],
            loc: {
              start: {
                line: 1,
                column: 0
              },
              end: {
                line: 1,
                column: 13
              }
            }
          },
          loc: {
            start: {
              line: 1,
              column: 0
            },
            end: {
              line: 1,
              column: 13
            }
          }
        }
      ],
      loc: {
        start: {
          line: 1,
          column: 0
        },
        end: {
          line: 1,
          column: 13
        }
      },
      errors: []
    });

    assert.deepEqual(purified, this.expected);
  });

  it('eliminate custom property', function () {
    var ast = esprima.parse('assert("foo")', {tolerant: true, raw: true});
    estraverse.replace(ast, {
      leave: function (currentNode, parentNode) {
        if (currentNode.type === syntax.Literal && typeof currentNode.raw !== 'undefined') {
          currentNode['x-verbatim-bar'] = {
            content: currentNode.raw,
            precedence: 18 // escodegen.Precedence.Primary
          };
          return currentNode;
        } else {
          return undefined;
        }
      }
    });
    var purified = espurify(ast);

    assert.deepEqual(ast, {
      type: 'Program',
      sourceType: 'script',
      body: [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'CallExpression',
            callee: {
              type: 'Identifier',
              name: 'assert'
            },
            arguments: [
              {
                type: 'Literal',
                value: 'foo',
                raw: '"foo"',
                'x-verbatim-bar': {
                  content: '"foo"',
                  precedence: 18
                }
              }
            ]
          }
        }
      ],
      errors: []
    });

    assert.deepEqual(purified, this.expected);
  });
});

it('RegExpLiteral', function () {
  var ast = esprima.parse('var re = /^foo$/im', {tolerant: true, tokens: true, range: true, raw: true});
  var expected = {
    type: 'Program',
    sourceType: 'script',
    body: [
      {
        type: 'VariableDeclaration',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: {
              type: 'Identifier',
              name: 're'
            },
            init: {
              type: 'Literal',
              value: {},
              regex: {
                pattern: '^foo$',
                flags: 'im'
              }
            }
          }
        ],
        kind: 'var'
      }
    ]
  };
  var purified = espurify(ast);
  assert.deepEqual(purified, expected);
});

it('ES6 features', function () {
  var ast = esprima.parse('evens.map(v => v + 1);', {tolerant: true, tokens: true, range: true, raw: true});
  var expected = {
    type: 'Program',
    sourceType: 'script',
    body: [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            computed: false,
            object: {
              type: 'Identifier',
              name: 'evens'
            },
            property: {
              type: 'Identifier',
              name: 'map'
            }
          },
          arguments: [
            {
              type: 'ArrowFunctionExpression',
              id: null,
              params: [
                {
                  type: 'Identifier',
                  name: 'v'
                }
              ],
              body: {
                type: 'BinaryExpression',
                operator: '+',
                left: {
                  type: 'Identifier',
                  name: 'v'
                },
                right: {
                  type: 'Literal',
                  value: 1
                }
              },
              generator: false,
              async: false,
              expression: true
            }
          ]
        }
      }
    ]
  };
  var purified = espurify(ast);
  assert.deepEqual(purified, expected);
});

it('ES2017 features', function () {
  var ast = acorn.parse('async function foo (task) { return await task(); }',
    {locations: true, ranges: true, ecmaVersion: 2017}
  );
  var expected = {
    type: 'Program',
    sourceType: 'script',
    body: [
      {
        type: 'FunctionDeclaration',
        id: {
          name: 'foo',
          type: 'Identifier'
        },
        params: [
          {
            name: 'task',
            type: 'Identifier'
          }
        ],
        body: {
          type: 'BlockStatement',
          body: [
            {
              type: 'ReturnStatement',
              argument: {
                type: 'AwaitExpression',
                argument: {
                  type: 'CallExpression',
                  callee: {
                    name: 'task',
                    type: 'Identifier'
                  },
                  arguments: []
                }
              }
            }
          ]
        },
        generator: false,
        async: true
      }
    ]
  };
  var purified = espurify(ast);
  assert.deepEqual(purified, expected);
});

it('ES2018 features (for-await-of)', function () {
  var ast = acorn.parse('async function f() { for await (const x of a()) { assert(x); } }',
    {locations: true, ranges: true, ecmaVersion: 2018}
  );
  var expected = {
    type: 'Program',
    body: [
      {
        type: 'FunctionDeclaration',
        id: {
          type: 'Identifier',
          name: 'f'
        },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [
            {
              type: 'ForOfStatement',
              await: true,
              left: {
                type: 'VariableDeclaration',
                declarations: [
                  {
                    type: 'VariableDeclarator',
                    id: {
                      type: 'Identifier',
                      name: 'x'
                    },
                    init: null
                  }
                ],
                kind: 'const'
              },
              right: {
                type: 'CallExpression',
                callee: {
                  type: 'Identifier',
                  name: 'a'
                },
                arguments: []
              },
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'ExpressionStatement',
                    expression: {
                      type: 'CallExpression',
                      callee: {
                        type: 'Identifier',
                        name: 'assert'
                      },
                      arguments: [
                        {
                          type: 'Identifier',
                          name: 'x'
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        },
        generator: false,
        async: true
      }
    ],
    sourceType: 'script'
  };
  var purified = espurify(ast);
  assert.deepEqual(purified, expected);
});

function traverse (object, currentKey, visitor) {
  var key, child;
  visitor(object, currentKey);
  for (key in object) {
    if (object.hasOwnProperty(key)) {
      child = object[key];
      if (typeof child === 'object' && child !== null) {
        traverse(child, key, visitor);
      }
    }
  }
}

describe('cloneWithWhitelist', function () {
  beforeEach(function () {
    var code = fs.readFileSync(path.join(__dirname, 'fixtures', 'CounterContainer.jsx'), 'utf8');
    var babelAst = babylon.parse(code, {
      sourceType: 'module',
      plugins: [
        'classProperties',
        'jsx',
        'flow'
      ]
    });
    this.ast = babelAst.program;
  });
  it('complete whitelist', function () {
    var astWhiteList = Object.keys(babelTypes.BUILDER_KEYS).reduce(function (props, key) {
      props[key] = ['type'].concat(babelTypes.BUILDER_KEYS[key]);
      return props;
    }, {});
    var purifyAst = espurify.cloneWithWhitelist(astWhiteList);
    var purified = purifyAst(this.ast);
    traverse(purified, null, function (node, key) {
      assert.notEqual(key, 'loc');
      assert.notEqual(key, 'start');
      assert.notEqual(key, 'end');
    });
  });
  it('babel.types.BUILDER_KEYS', function () {
    var purifyAst = espurify.cloneWithWhitelist(babelTypes.BUILDER_KEYS);
    var purified = purifyAst(this.ast);
    traverse(purified, null, function (node, key) {
      assert.notEqual(key, 'loc');
      assert.notEqual(key, 'start');
      assert.notEqual(key, 'end');
    });
  });
});

describe('dealing with circular references in AST', function () {
  it('circular references in standard node tree', function () {
    var ident = {
      type: 'Identifier',
      name: 'assert'
    };
    var literal = {
      type: 'Literal',
      value: 'foo',
      raw: '"foo"'
    };
    var callExp = {
      type: 'CallExpression',
      callee: ident,
      arguments: [ literal ]
    };
    ident.parent = callExp;
    literal.parent = callExp;
    var expStmt = {
      type: 'ExpressionStatement',
      expression: callExp
    };
    callExp.parent = expStmt;
    var program = {
      type: 'Program',
      sourceType: 'script',
      body: [ expStmt ],
      errors: []
    };
    expStmt.parent = program;

    assert.deepEqual(espurify(program), {
      type: 'Program',
      sourceType: 'script',
      body: [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'CallExpression',
            callee: {
              type: 'Identifier',
              name: 'assert'
            },
            arguments: [
              {
                type: 'Literal',
                value: 'foo'
              }
            ]
          }
        }
      ]
    });
  });

  it('circular references in non-standard node tree', function () {
    var key0 = {
      type: 'Identifier',
      name: 'qty'
    };
    var value0 = {
      type: 'NumberTypeAnnotation'
    };
    var prop0 = {
      type: 'ObjectTypeProperty',
      key: key0,
      value: value0
    };
    key0.parent = prop0;
    value0.parent = prop0;
    var key1 = {
      type: 'Identifier',
      name: 'total'
    };
    var value1 = {
      type: 'NumberTypeAnnotation'
    };
    var prop1 = {
      type: 'ObjectTypeProperty',
      key: key1,
      value: value1
    };
    key1.parent = prop1;
    value1.parent = prop1;
    var right = {
      type: 'ObjectTypeAnnotation',
      properties: [
        prop0,
        prop1
      ],
      indexers: [],
      callProperties: []
    };
    prop0.parent = right;
    prop1.parent = right;
    var id = {
      type: 'Identifier',
      name: 'CounterContainerStateType'
    };
    var root = {type: 'TypeAlias', id, typeParameters: null, right};
    id.parent = root;
    right.parent = root;

    assert.deepEqual(espurify(root), {
      type: 'TypeAlias',
      id: {
        type: 'Identifier',
        name: 'CounterContainerStateType'
      },
      typeParameters: null,
      right: {
        type: 'ObjectTypeAnnotation',
        properties: [
          {
            type: 'ObjectTypeProperty',
            key: {
              type: 'Identifier',
              name: 'qty'
            },
            value: {
              type: 'NumberTypeAnnotation'
            }
          },
          {
            type: 'ObjectTypeProperty',
            key: {
              type: 'Identifier',
              name: 'total'
            },
            value: {
              type: 'NumberTypeAnnotation'
            }
          }
        ],
        indexers: [],
        callProperties: []
      }
    });
  });
});
