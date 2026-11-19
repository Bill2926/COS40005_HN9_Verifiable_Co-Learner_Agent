import os
import shutil
import stat
import subprocess
import sys

jail = "/opt/jail"


def copy_file(path):
    if not path or not os.path.exists(path):
        return
    real = os.path.realpath(path)
    dest = jail + real
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if not os.path.exists(dest):
        shutil.copy2(real, dest)
    if real != path:
        link = jail + path
        os.makedirs(os.path.dirname(link), exist_ok=True)
        if not os.path.lexists(link):
            os.symlink(os.path.relpath(dest, os.path.dirname(link)), link)


def copy_deps(binary):
    try:
        listed = subprocess.check_output(["ldd", binary], text=True, stderr=subprocess.DEVNULL)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return
    for line in listed.splitlines():
        parts = line.split()
        path = None
        if "=>" in parts:
            arrow = parts.index("=>")
            if arrow + 1 < len(parts) and parts[arrow + 1].startswith("/"):
                path = parts[arrow + 1]
        elif parts and parts[0].startswith("/") and "ld-" in parts[0]:
            path = parts[0]
        if path:
            copy_file(path)


py = os.path.realpath(shutil.which("python3"))
copy_file(py)
bindir = os.path.join(jail, "usr", "local", "bin")
os.makedirs(bindir, exist_ok=True)
target = jail + py
link = os.path.join(bindir, "python3")
if not os.path.exists(link):
    os.symlink(os.path.relpath(target, bindir), link)

prefix = subprocess.check_output([py, "-c", "import sys; print(sys.prefix)"], text=True).strip()
stdlib = os.path.join(prefix, "lib")
shutil.copytree(stdlib, jail + stdlib, symlinks=True, dirs_exist_ok=True)
copy_deps(py)

version = f"python{sys.version_info.major}.{sys.version_info.minor}"
dynload = os.path.join(stdlib, version, "lib-dynload")
if os.path.isdir(dynload):
    for name in os.listdir(dynload):
        if name.endswith(".so"):
            copy_deps(os.path.join(dynload, name))

dev = os.path.join(jail, "dev")
os.makedirs(dev, exist_ok=True)
for name, major, minor in (("null", 1, 3), ("zero", 1, 5), ("urandom", 1, 9)):
    node = os.path.join(dev, name)
    if not os.path.exists(node):
        os.mknod(node, stat.S_IFCHR | 0o666, os.makedev(major, minor))

tmp = os.path.join(jail, "tmp")
os.makedirs(tmp, exist_ok=True)
os.chmod(tmp, 0o1777)
