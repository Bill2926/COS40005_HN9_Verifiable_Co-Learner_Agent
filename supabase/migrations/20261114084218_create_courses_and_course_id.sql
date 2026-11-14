-- Courses live in the database (ADR-0004). A course is stored as its whole course spec, so
-- importing a spec replaces one row and exporting reads one. The spec holds teacher-only content
-- (hint ladders, misconception responses, reference solutions, the correct quiz choice), so only
-- the server, with the secret key, may read or write it: row level security is on, no policy is
-- created, and every privilege is revoked from anon and authenticated.

create table public.courses (
  id text primary key,
  title text not null,
  spec jsonb not null,
  updated_at timestamptz not null default now(),
  constraint courses_spec_course_id check (spec ->> 'courseId' = id),
  constraint courses_spec_title check (spec ->> 'title' = title)
);

alter table public.courses enable row level security;

revoke all on table public.courses from anon, authenticated;
grant all on table public.courses to service_role;

-- The first course, imported from web/server/course/python-course.ts. Later changes come from a
-- lecturer importing a new spec, never from a migration.
insert into public.courses (id, title, spec)
values (
  'intro_python',
  'Introduction to Programming with Python',
  $spec${
  "specVersion": 1,
  "courseId": "intro_python",
  "title": "Introduction to Programming with Python",
  "masteryThreshold": 0.9,
  "parts": [
    "Foundations",
    "Control Flow",
    "Built-in Data Structures",
    "Organizing Code",
    "Working with the Real World"
  ],
  "modules": [
    {
      "id": "getting_started",
      "name": "Getting Started with Programming and Python",
      "part": "Foundations",
      "summary": "What programming is, algorithms as steps, and a first program with print() and comments",
      "keywords": [
        "Getting Started with Programming and Python"
      ],
      "content": {
        "materials": {
          "heading": "A first program",
          "body": "A program is a list of steps the computer follows. print() shows text, and a comment, a line that starts with #, is a note for a person. Python skips comments.",
          "example": "# Show a greeting\nprint(\"Hello, world\")",
          "keyPoint": "The text you want to show sits inside quotes. A comment starts with # and is not run.",
          "scopeNote": "These materials belong to this module alone."
        },
        "exercises": [
          {
            "id": "say_hello",
            "title": "Say hello",
            "statement": "Write hello(name) so it returns a greeting: Hello, then a space, then the name. Put a comment above the return that says what the function does.",
            "starterCode": "def hello(name):\n    pass\n",
            "tests": [
              {
                "name": "greeting for An",
                "expression": "hello(\"An\")",
                "expected": "Hello, An"
              },
              {
                "name": "greeting for Mai",
                "expression": "hello(\"Mai\")",
                "expected": "Hello, Mai"
              },
              {
                "name": "greeting for world",
                "expression": "hello(\"world\")",
                "expected": "Hello, world"
              }
            ],
            "referenceSolution": "def hello(name):\n    # Greet the person by name\n    return \"Hello, \" + name"
          },
          {
            "id": "join_words",
            "title": "Join two words",
            "statement": "Write join_words(first, second) so it returns the two words with a space between them.",
            "starterCode": "def join_words(first, second):\n    pass\n",
            "tests": [
              {
                "name": "hello and a name",
                "expression": "join_words(\"Hello\", \"An\")",
                "expected": "Hello An"
              },
              {
                "name": "two words",
                "expression": "join_words(\"Python\", \"program\")",
                "expected": "Python program"
              },
              {
                "name": "a short start",
                "expression": "join_words(\"Good\", \"start\")",
                "expected": "Good start"
              }
            ],
            "referenceSolution": "def join_words(first, second):\n    return first + \" \" + second"
          },
          {
            "id": "sign_the_program",
            "title": "Sign the program",
            "statement": "Write sign_off(name) so it returns the name followed by \" wrote this program\".",
            "starterCode": "def sign_off(name):\n    pass\n",
            "tests": [
              {
                "name": "signed by An",
                "expression": "sign_off(\"An\")",
                "expected": "An wrote this program"
              },
              {
                "name": "signed by Mai",
                "expression": "sign_off(\"Mai\")",
                "expected": "Mai wrote this program"
              },
              {
                "name": "signed by Lee",
                "expression": "sign_off(\"Lee\")",
                "expected": "Lee wrote this program"
              }
            ],
            "referenceSolution": "def sign_off(name):\n    return name + \" wrote this program\""
          }
        ],
        "quiz": [
          {
            "id": "print-text",
            "prompt": "Which line displays the literal word Hello?",
            "choices": [
              "print(Hello)",
              "print(\"Hello\")",
              "# print(\"Hello\")",
              "print(\"#Hello\")"
            ],
            "correctIndex": 1,
            "explanation": "Quotes make Hello literal text. print() displays that text.",
            "misconceptions": {
              "0": "missing_quotes"
            }
          },
          {
            "id": "comment-line",
            "prompt": "Which line is a comment Python skips?",
            "choices": [
              "print(\"# Note\")",
              "print(\"A note\")",
              "\"Note for a reader\"",
              "# Note for a reader"
            ],
            "correctIndex": 3,
            "explanation": "A line beginning with # is a comment. A # inside quotes is part of the text."
          },
          {
            "id": "program-steps",
            "prompt": "What is a program?",
            "choices": [
              "A list of steps for a computer",
              "A list of notes for a reader",
              "A list of words to display",
              "A list of names for commands"
            ],
            "correctIndex": 0,
            "explanation": "A program gives the computer steps to follow. It can include notes or display text, but those are only parts of a program."
          }
        ],
        "hintLadder": [
          "Text you want to show or return sits between quotes, like \"Hello\".",
          "Join two pieces of text with +. A space is text as well: \" \".",
          "Return the text you built. A comment starts with # and does not change what is returned."
        ],
        "misconceptionResponses": [
          {
            "id": "missing_quotes",
            "response": "The words are missing their quotes, so Python looks for a variable instead of using the text. Put the text between quotes."
          }
        ]
      }
    },
    {
      "id": "variables",
      "name": "Variables, Data Types, and Operators",
      "part": "Foundations",
      "summary": "Variables, data types, operators, input(), and type casting",
      "keywords": [
        "Variables, Data Types, and Operators"
      ],
      "content": {
        "materials": {
          "heading": "Names for values",
          "body": "A variable is a name for a value. A value has a type: a whole number (int), a decimal (float), text (str), or true or false (bool). Operators such as +, *, and >= combine values. input() reads text, and int() turns that text into a whole number.",
          "example": "years = int(\"2\")\nprint(years + 1)",
          "keyPoint": "input() gives you text. Use int() before you do arithmetic with it.",
          "scopeNote": "These materials belong to this module alone."
        },
        "exercises": [
          {
            "id": "total_cost",
            "title": "Total cost",
            "statement": "Write total_cost(price, count) so it returns the price multiplied by the count.",
            "starterCode": "def total_cost(price, count):\n    pass\n",
            "tests": [
              {
                "name": "four at three",
                "expression": "total_cost(4, 3)",
                "expected": "12"
              },
              {
                "name": "one item",
                "expression": "total_cost(10, 1)",
                "expected": "10"
              },
              {
                "name": "nothing to buy",
                "expression": "total_cost(0, 5)",
                "expected": "0"
              }
            ],
            "referenceSolution": "def total_cost(price, count):\n    return price * count"
          },
          {
            "id": "whole_number",
            "title": "Whole number",
            "statement": "Write whole_number(text) so it returns the text as a whole number. \"12\" becomes 12.",
            "starterCode": "def whole_number(text):\n    pass\n",
            "tests": [
              {
                "name": "twelve",
                "expression": "whole_number(\"12\")",
                "expected": "12"
              },
              {
                "name": "zero",
                "expression": "whole_number(\"0\")",
                "expected": "0"
              },
              {
                "name": "seven",
                "expression": "whole_number(\"7\")",
                "expected": "7"
              }
            ],
            "referenceSolution": "def whole_number(text):\n    return int(text)"
          },
          {
            "id": "old_enough",
            "title": "Old enough",
            "statement": "Write old_enough(age) so it returns True when the age is 18 or more, and False otherwise.",
            "starterCode": "def old_enough(age):\n    pass\n",
            "tests": [
              {
                "name": "eighteen",
                "expression": "old_enough(18)",
                "expected": "True"
              },
              {
                "name": "seventeen",
                "expression": "old_enough(17)",
                "expected": "False"
              },
              {
                "name": "forty",
                "expression": "old_enough(40)",
                "expected": "True"
              }
            ],
            "referenceSolution": "def old_enough(age):\n    return age >= 18"
          }
        ],
        "quiz": [
          {
            "id": "input-arithmetic",
            "prompt": "Which expression reads any whole-number age the user types and adds one to it?",
            "choices": [
              "input() + 1",
              "input() + \"1\"",
              "int(input()) + 1",
              "int(\"1\") + 1"
            ],
            "correctIndex": 2,
            "explanation": "input() returns text. Convert it with int() before adding one.",
            "misconceptions": {
              "0": "added_text_to_a_number"
            }
          },
          {
            "id": "value-type",
            "prompt": "Which type represents a decimal number like 2.5?",
            "choices": [
              "int",
              "float",
              "str",
              "bool"
            ],
            "correctIndex": 1,
            "explanation": "A float represents a decimal number. An int represents a whole number."
          },
          {
            "id": "variable-name",
            "prompt": "In `years = int(\"2\")`, what does `years` name?",
            "choices": [
              "The text \"2\"",
              "The function int",
              "The type str",
              "The whole number 2"
            ],
            "correctIndex": 3,
            "explanation": "int() converts the text into the whole number 2, and years names that value."
          }
        ],
        "hintLadder": [
          "Give the result a name if you want, then return that name. price * count is the total.",
          "int(text) turns the characters \"12\" into the number 12.",
          "age >= 18 is True or False. Return that comparison."
        ],
        "misconceptionResponses": [
          {
            "id": "added_text_to_a_number",
            "response": "A number was joined to text. int() turns text into a number first, and then + can add."
          }
        ]
      }
    },
    {
      "id": "strings",
      "name": "Working with Strings",
      "part": "Foundations",
      "summary": "Indexing, slicing, string methods, and f-strings",
      "keywords": [
        "Working with Strings"
      ],
      "content": {
        "materials": {
          "heading": "Text, piece by piece",
          "body": "A string is text. Indexing picks one character, and the first character is at 0. Slicing takes a stretch of the text. Methods such as upper, split, replace, and strip tidy or change it. An f-string drops a value into the text.",
          "example": "name = \"An\"\nprint(f\"Hello, {name}\")",
          "keyPoint": "The first character is at index 0, not 1.",
          "scopeNote": "These materials belong to this module alone."
        },
        "exercises": [
          {
            "id": "first_character",
            "title": "First character",
            "statement": "Write first_character(word) so it returns the first character of the word.",
            "starterCode": "def first_character(word):\n    pass\n",
            "tests": [
              {
                "name": "python",
                "expression": "first_character(\"Python\")",
                "expected": "P"
              },
              {
                "name": "an",
                "expression": "first_character(\"An\")",
                "expected": "A"
              },
              {
                "name": "hi",
                "expression": "first_character(\"Hi\")",
                "expected": "H"
              }
            ],
            "referenceSolution": "def first_character(word):\n    return word[0]"
          },
          {
            "id": "shout",
            "title": "Shout",
            "statement": "Write shout(word) so it returns the word in uppercase.",
            "starterCode": "def shout(word):\n    pass\n",
            "tests": [
              {
                "name": "hello",
                "expression": "shout(\"hello\")",
                "expected": "HELLO"
              },
              {
                "name": "python",
                "expression": "shout(\"Python\")",
                "expected": "PYTHON"
              },
              {
                "name": "ok",
                "expression": "shout(\"ok\")",
                "expected": "OK"
              }
            ],
            "referenceSolution": "def shout(word):\n    return word.upper()"
          },
          {
            "id": "greeting",
            "title": "Greeting",
            "statement": "Write greeting(name) so it returns Hello, then a space, then the name. Use an f-string.",
            "starterCode": "def greeting(name):\n    pass\n",
            "tests": [
              {
                "name": "an",
                "expression": "greeting(\"An\")",
                "expected": "Hello, An"
              },
              {
                "name": "mai",
                "expression": "greeting(\"Mai\")",
                "expected": "Hello, Mai"
              },
              {
                "name": "lee",
                "expression": "greeting(\"Lee\")",
                "expected": "Hello, Lee"
              }
            ],
            "referenceSolution": "def greeting(name):\n    return f\"Hello, {name}\""
          }
        ],
        "quiz": [
          {
            "id": "first-index",
            "prompt": "Which expression selects the first character of `word = \"cat\"`?",
            "choices": [
              "word[0]",
              "word[1]",
              "word[2]",
              "word[3]"
            ],
            "correctIndex": 0,
            "explanation": "String indexing starts at zero. word[0] selects c, and word[1] selects a.",
            "misconceptions": {
              "1": "index_starts_at_one"
            }
          },
          {
            "id": "insert-value",
            "prompt": "Which expression inserts the value of `name` after Hello?",
            "choices": [
              "\"Hello, {name}\"",
              "f\"Hello, name\"",
              "f\"Hello, {name}\"",
              "\"Hello, name\""
            ],
            "correctIndex": 2,
            "explanation": "The f prefix makes this an f-string. The braces tell Python to insert the value of name."
          },
          {
            "id": "slice-text",
            "prompt": "Which operation is designed to take a stretch of characters from a string?",
            "choices": [
              "Indexing the string",
              "Slicing the string",
              "Uppercasing the string",
              "Stripping the string"
            ],
            "correctIndex": 1,
            "explanation": "Slicing selects a stretch of text. Indexing selects one character."
          }
        ],
        "hintLadder": [
          "word[0] is the first character. Counting starts at 0.",
          "word.upper() returns a new string in capitals and leaves word itself unchanged.",
          "An f-string looks like f\"Hello, {name}\". The braces drop the value in."
        ],
        "misconceptionResponses": [
          {
            "id": "index_starts_at_one",
            "response": "The first character is at index 0, not 1. word[1] is the second character."
          }
        ]
      }
    },
    {
      "id": "conditionals",
      "name": "Conditional Statements",
      "part": "Control Flow",
      "summary": "if, elif, else, nested conditions, and logical operators",
      "keywords": [
        "Conditional Statements"
      ],
      "content": {
        "materials": {
          "heading": "Choosing a path",
          "body": "if, elif, and else choose which steps run. Python checks the conditions from top to bottom and runs only the first branch that is true. Conditions can be nested, and and, or, and not combine them.",
          "example": "if score >= 50:\n    print(\"pass\")\nelse:\n    print(\"try again\")",
          "keyPoint": "Only the first true branch runs. The others are skipped.",
          "scopeNote": "These materials belong to this module alone."
        },
        "exercises": [
          {
            "id": "sign_of",
            "title": "Sign of a number",
            "statement": "Write sign_of(number) so it returns \"positive\", \"negative\", or \"zero\".",
            "starterCode": "def sign_of(number):\n    pass\n",
            "tests": [
              {
                "name": "positive",
                "expression": "sign_of(3)",
                "expected": "positive"
              },
              {
                "name": "negative",
                "expression": "sign_of(-2)",
                "expected": "negative"
              },
              {
                "name": "zero",
                "expression": "sign_of(0)",
                "expected": "zero"
              }
            ],
            "referenceSolution": "def sign_of(number):\n    if number > 0:\n        return \"positive\"\n    if number < 0:\n        return \"negative\"\n    return \"zero\""
          },
          {
            "id": "ticket",
            "title": "Ticket",
            "statement": "Write ticket(age) so it returns \"child\" under 12, \"student\" from 12 to 17, and \"adult\" from 18.",
            "starterCode": "def ticket(age):\n    pass\n",
            "tests": [
              {
                "name": "child",
                "expression": "ticket(10)",
                "expected": "child"
              },
              {
                "name": "student",
                "expression": "ticket(15)",
                "expected": "student"
              },
              {
                "name": "adult",
                "expression": "ticket(30)",
                "expected": "adult"
              }
            ],
            "referenceSolution": "def ticket(age):\n    if age < 12:\n        return \"child\"\n    if age < 18:\n        return \"student\"\n    return \"adult\""
          },
          {
            "id": "marked_result",
            "title": "Marked result",
            "statement": "Write result(score, submitted) so it returns \"missing\" when submitted is false, \"pass\" when the score is 50 or more, and \"fail\" otherwise.",
            "starterCode": "def result(score, submitted):\n    pass\n",
            "tests": [
              {
                "name": "a pass",
                "expression": "result(80, True)",
                "expected": "pass"
              },
              {
                "name": "a fail",
                "expression": "result(40, True)",
                "expected": "fail"
              },
              {
                "name": "not submitted",
                "expression": "result(90, False)",
                "expected": "missing"
              }
            ],
            "referenceSolution": "def result(score, submitted):\n    if not submitted:\n        return \"missing\"\n    if score >= 50:\n        return \"pass\"\n    return \"fail\""
          }
        ],
        "quiz": [
          {
            "id": "branch-order",
            "prompt": "An `if` condition and the following `elif` condition would both be true. Which branches run?",
            "choices": [
              "Only the elif branch",
              "Only the else branch",
              "Both the if and elif branches",
              "Only the if branch"
            ],
            "correctIndex": 3,
            "explanation": "Python runs the first matching branch and skips the rest of the chain.",
            "misconceptions": {
              "2": "every_branch_runs"
            }
          },
          {
            "id": "else-branch",
            "prompt": "When does the `else` branch of an `if` and `elif` chain run?",
            "choices": [
              "When no earlier condition is true",
              "When all earlier conditions are true",
              "When the first condition is true",
              "When only the last condition is true"
            ],
            "correctIndex": 0,
            "explanation": "The else branch is the fallback when none of the earlier conditions is true."
          },
          {
            "id": "nested-condition",
            "prompt": "What makes a conditional nested?",
            "choices": [
              "It follows another conditional",
              "It has more than one branch",
              "It sits inside another branch",
              "It uses more than one condition"
            ],
            "correctIndex": 2,
            "explanation": "A conditional is nested when it appears inside a branch of another conditional."
          }
        ],
        "hintLadder": [
          "Check the cases from top to bottom. Return as soon as one case matches.",
          "age < 12 is the child case. The next check can be age < 18, because 11 has already returned.",
          "if not submitted comes before the score check, or a missing paper could be marked as a pass."
        ],
        "misconceptionResponses": [
          {
            "id": "every_branch_runs",
            "response": "Only the first true branch runs. elif and else are skipped once an earlier condition matched."
          }
        ]
      }
    },
    {
      "id": "loops",
      "name": "Loops",
      "part": "Control Flow",
      "summary": "for, range(), while, break, continue, and nested loops",
      "keywords": [
        "Loops"
      ],
      "content": {
        "materials": {
          "heading": "Accumulating a total",
          "body": "A running total needs a variable that survives every pass of the loop. for walks a collection, range() builds a sequence of numbers, and while repeats while a condition stays true. break leaves the loop early, continue skips to the next pass, and a loop can sit inside another loop.",
          "example": "# Create the total before the loop\ns = 0\nfor x in ds:\n    s = s + x",
          "keyPoint": "Look at where `s = 0` is. If it were inside the loop, the total would go back to zero on every pass and forget the numbers before it.",
          "scopeNote": "These materials belong to this module alone."
        },
        "exercises": [
          {
            "id": "sum_of_a_list",
            "title": "Sum of a list",
            "statement": "Add up every number in a list. Use a `for` loop, and create the total before the loop so it survives every pass.",
            "starterCode": "def total(ds):\n    pass\n",
            "tests": [
              {
                "name": "three numbers",
                "expression": "total([1, 2, 3])",
                "expected": "6"
              },
              {
                "name": "one number",
                "expression": "total([10])",
                "expected": "10"
              },
              {
                "name": "empty list",
                "expression": "total([])",
                "expected": "0"
              }
            ],
            "referenceSolution": "def total(ds):\n    s = 0\n    for x in ds:\n        s = s + x\n    return s"
          },
          {
            "id": "count_the_even_numbers",
            "title": "Count the even numbers",
            "statement": "Count how many numbers in a list are even. Use a `for` loop.",
            "starterCode": "def count_even(ds):\n    pass\n",
            "tests": [
              {
                "name": "two evens",
                "expression": "count_even([1, 2, 3, 4])",
                "expected": "2"
              },
              {
                "name": "all even",
                "expression": "count_even([2, 4, 6])",
                "expected": "3"
              },
              {
                "name": "none even",
                "expression": "count_even([1, 3, 5])",
                "expected": "0"
              }
            ],
            "referenceSolution": "def count_even(ds):\n    n = 0\n    for x in ds:\n        if x % 2 == 0:\n            n = n + 1\n    return n"
          },
          {
            "id": "count_the_items",
            "title": "Count the items",
            "statement": "Count how many items are in a list. Use a `for` loop, and start the count at zero before the loop.",
            "starterCode": "def count_items(ds):\n    pass\n",
            "tests": [
              {
                "name": "three items",
                "expression": "count_items([1, 2, 3])",
                "expected": "3"
              },
              {
                "name": "one item",
                "expression": "count_items([10])",
                "expected": "1"
              },
              {
                "name": "empty list",
                "expression": "count_items([])",
                "expected": "0"
              }
            ],
            "referenceSolution": "def count_items(ds):\n    n = 0\n    for _ in ds:\n        n = n + 1\n    return n"
          }
        ],
        "quiz": [
          {
            "id": "running-total",
            "prompt": "Where should you set a running total to zero so it remembers every number you add?",
            "choices": [
              "At the start of every pass",
              "Once before the loop starts",
              "At the end of every pass",
              "Once after the loop ends"
            ],
            "correctIndex": 1,
            "explanation": "Setting the total to zero before the loop lets each pass build on the previous total.",
            "misconceptions": {
              "0": "accumulator_reset_inside_loop",
              "2": "accumulator_reset_inside_loop"
            }
          },
          {
            "id": "skip-pass",
            "prompt": "Which keyword skips the rest of the current pass and goes to the next one?",
            "choices": [
              "break",
              "while",
              "for",
              "continue"
            ],
            "correctIndex": 3,
            "explanation": "continue skips the rest of the current pass. break exits the loop entirely."
          },
          {
            "id": "while-condition",
            "prompt": "What does `while` check before starting each pass?",
            "choices": [
              "Whether its condition stays true",
              "Whether its condition stays false",
              "Whether it finishes its first pass",
              "Whether it has a loop inside it"
            ],
            "correctIndex": 0,
            "explanation": "A while loop repeats while its condition is true. When the condition becomes false, it stops."
          }
        ],
        "hintLadder": [
          "A running total has to be created before the loop. A variable created inside the loop starts again on every pass.",
          "Add each number to that same total. Do not set the total back to zero inside the loop.",
          "When the loop finishes, return the total. It should hold every number you added."
        ],
        "misconceptionResponses": [
          {
            "id": "accumulator_reset_inside_loop",
            "response": "The total is set back to zero inside the loop, so each pass forgets the numbers before it. Create the total once, before the loop starts."
          }
        ]
      }
    },
    {
      "id": "lists_and_tuples",
      "name": "Lists and Tuples",
      "part": "Built-in Data Structures",
      "summary": "Creating, changing, and looping over lists and tuples",
      "keywords": [
        "Lists and Tuples"
      ]
    },
    {
      "id": "dictionaries_and_sets",
      "name": "Dictionaries and Sets",
      "part": "Built-in Data Structures",
      "summary": "Dictionaries, sets, and basic list comprehensions",
      "keywords": [
        "Dictionaries and Sets"
      ]
    },
    {
      "id": "functions",
      "name": "Functions",
      "part": "Organizing Code",
      "summary": "Defining functions, parameters, return values, and scope",
      "keywords": [
        "Functions"
      ]
    },
    {
      "id": "modules_and_library",
      "name": "Modules and the Standard Library",
      "part": "Organizing Code",
      "summary": "import, the standard library, pip, and virtual environments",
      "keywords": [
        "Modules and the Standard Library"
      ]
    },
    {
      "id": "file_handling",
      "name": "File Handling",
      "part": "Working with the Real World",
      "summary": "Reading and writing text, CSV, and JSON files",
      "keywords": [
        "File Handling"
      ]
    },
    {
      "id": "error_handling",
      "name": "Error Handling and Debugging",
      "part": "Working with the Real World",
      "summary": "Errors, try / except / finally, tracebacks, and simple tests",
      "keywords": [
        "Error Handling and Debugging"
      ]
    }
  ],
  "outOfCourseKeywords": [
    "classes",
    "inheritance",
    "polymorphism",
    "algorithm complexity",
    "stacks",
    "queues",
    "linked lists",
    "trees",
    "graphs",
    "hand-written sorting and searching",
    "decorators",
    "generators",
    "async",
    "multithreading",
    "numpy",
    "pandas",
    "matplotlib",
    "flask",
    "django",
    "machine learning"
  ]
}$spec$::jsonb
)
on conflict (id) do nothing;

-- Student data belongs to one course. Existing rows are all Introduction to Programming with
-- Python. The column has no default: the server names the course on every write.

alter table public.evidence add column course_id text references public.courses (id);
update public.evidence set course_id = 'intro_python' where course_id is null;
alter table public.evidence alter column course_id set not null;
alter table public.evidence drop constraint evidence_student_id_module_id_exercise_id_attempt_key;
alter table public.evidence
  add constraint evidence_student_course_module_exercise_attempt_key
  unique (student_id, course_id, module_id, exercise_id, attempt);
drop index public.evidence_student_recorded_at;
create index evidence_student_course_recorded_at on public.evidence (student_id, course_id, recorded_at, id);

alter table public.quiz_answers add column course_id text references public.courses (id);
update public.quiz_answers set course_id = 'intro_python' where course_id is null;
alter table public.quiz_answers alter column course_id set not null;
alter table public.quiz_answers drop constraint quiz_answers_student_id_module_id_question_id_key;
alter table public.quiz_answers
  add constraint quiz_answers_student_course_module_question_key
  unique (student_id, course_id, module_id, question_id);
drop index public.quiz_answers_student_module_recorded_at;
create index quiz_answers_student_course_module_recorded_at
  on public.quiz_answers (student_id, course_id, module_id, recorded_at, id);

alter table public.conversations add column course_id text references public.courses (id);
update public.conversations set course_id = 'intro_python' where course_id is null;
alter table public.conversations alter column course_id set not null;
alter table public.conversations drop constraint conversations_student_id_module_id_key;
alter table public.conversations
  add constraint conversations_student_course_module_key
  unique (student_id, course_id, module_id);

-- A resume point is per course: where the student left off in that course.
alter table public.resume_points add column course_id text references public.courses (id);
update public.resume_points set course_id = 'intro_python' where course_id is null;
alter table public.resume_points alter column course_id set not null;
alter table public.resume_points drop constraint resume_points_pkey;
alter table public.resume_points add primary key (student_id, course_id);

alter table public.decisions add column course_id text references public.courses (id);
update public.decisions set course_id = 'intro_python' where course_id is null;
alter table public.decisions alter column course_id set not null;

-- The attempt number counts submissions on one exercise of one course.
create or replace function private.assign_evidence_attempt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    new.student_id::text || '|' || new.course_id || '|' || new.module_id || '|' || new.exercise_id, 0));

  select coalesce(max(public.evidence.attempt), 0) + 1
  into new.attempt
  from public.evidence
  where public.evidence.student_id = new.student_id
    and public.evidence.course_id = new.course_id
    and public.evidence.module_id = new.module_id
    and public.evidence.exercise_id = new.exercise_id;

  return new;
end;
$$;

revoke all on function private.assign_evidence_attempt() from public, anon, authenticated;
