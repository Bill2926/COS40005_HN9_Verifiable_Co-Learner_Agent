export const approvedLibraries = [
  'math',
  'random',
  'string',
  'itertools',
  'collections',
  'datetime',
  're',
  'statistics',
  'functools',
]

export function libraryRefusal(library) {
  return `The library ${library} is not allowed.`
}

const approved = `set(${JSON.stringify(approvedLibraries)})`

export const importGuardSource = `
import ast as __ast__
import builtins as __builtins_module__
import sys as __sys__

__APPROVED__ = ${approved}

def __library_refusal__(name):
    return "The library " + name + " is not allowed."

def __top_name__(name):
    if not name:
        return None
    return name.split(".", 1)[0]

def __constant_top__(node):
    if isinstance(node, __ast__.Constant) and isinstance(node.value, str):
        return __top_name__(node.value)
    return None

def __disallowed__(code):
    try:
        tree = __ast__.parse(code)
    except SyntaxError:
        return None
    found = []
    for node in __ast__.walk(tree):
        if isinstance(node, __ast__.Import):
            for alias in node.names:
                top = __top_name__(alias.name)
                if top and top not in __APPROVED__:
                    found.append((node.lineno or 1, top))
        elif isinstance(node, __ast__.ImportFrom):
            if node.level and node.level > 0:
                found.append((node.lineno or 1, node.module or "."))
                continue
            top = __top_name__(node.module)
            if top and top not in __APPROVED__:
                found.append((node.lineno or 1, top))
        elif isinstance(node, __ast__.Call):
            library = None
            func = node.func
            if isinstance(func, __ast__.Name) and func.id == "__import__" and node.args:
                library = __constant_top__(node.args[0])
            elif isinstance(func, __ast__.Attribute) and func.attr == "import_module" and node.args:
                library = __constant_top__(node.args[0])
            if library and library not in __APPROVED__:
                found.append((node.lineno or 1, library))
    if not found:
        return None
    found.sort()
    return found[0]

__LOADING__ = []

class __ApprovedFinder__:
    def find_spec(self, fullname, path, target=None):
        top = fullname.split(".", 1)[0]
        if top in __APPROVED__ or (top.startswith("_") and __LOADING__):
            return None
        raise ImportError(__library_refusal__(top))

__FINDER__ = __ApprovedFinder__()

def __begin_import_guard__():
    if __FINDER__ not in __sys__.meta_path:
        __sys__.meta_path.insert(0, __FINDER__)

def __end_import_guard__():
    if __FINDER__ in __sys__.meta_path:
        __sys__.meta_path.remove(__FINDER__)

def __student_builtins__():
    real_import = __builtins_module__.__import__

    def guarded(name, globals=None, locals=None, fromlist=(), level=0):
        if level:
            raise ImportError(__library_refusal__("."))
        top = (name or "").split(".", 1)[0]
        if top not in __APPROVED__ and not (top.startswith("_") and __LOADING__):
            raise ImportError(__library_refusal__(top))
        if top in __APPROVED__:
            __LOADING__.append(top)
        try:
            return real_import(name, globals, locals, fromlist, level)
        finally:
            if top in __APPROVED__ and __LOADING__:
                __LOADING__.pop()

    copied = dict(vars(__builtins_module__))
    copied["__import__"] = guarded
    return copied
`
