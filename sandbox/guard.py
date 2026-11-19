import ast

APPROVED = {
    "math",
    "random",
    "string",
    "itertools",
    "collections",
    "datetime",
    "re",
    "statistics",
    "functools",
}

TOOK_TOO_LONG = "This took longer than 10 seconds, so it was stopped."
USED_TOO_MUCH_MEMORY = "This used more than 512 MB of memory, so it was stopped."
PRINTED_TOO_MUCH = "This printed more than 64 KB, so it was stopped."
OUTPUT_LIMIT = 64 * 1024
SECONDS = 10
MEMORY_BYTES = 512 * 1024 * 1024


def refusal(library):
    return "The library " + library + " is not allowed."


def _top(name):
    if not name:
        return None
    return name.split(".", 1)[0]


def _constant_top(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return _top(node.value)
    return None


def _called_library(node):
    func = node.func
    if isinstance(func, ast.Name) and func.id == "__import__" and node.args:
        return _constant_top(node.args[0])
    if isinstance(func, ast.Attribute) and func.attr == "import_module" and node.args:
        return _constant_top(node.args[0])
    return None


def first_disallowed(code):
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return None
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                top = _top(alias.name)
                if top and top not in APPROVED:
                    found.append((node.lineno or 1, top))
        elif isinstance(node, ast.ImportFrom):
            if node.level and node.level > 0:
                found.append((node.lineno or 1, node.module or "."))
                continue
            top = _top(node.module)
            if top and top not in APPROVED:
                found.append((node.lineno or 1, top))
        elif isinstance(node, ast.Call):
            library = _called_library(node)
            if library and library not in APPROVED:
                found.append((node.lineno or 1, library))
    if not found:
        return None
    found.sort()
    return found[0][1], found[0][0]
