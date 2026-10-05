"""Port UI consistency changes from production -> git main (tolerant: reports missing anchors)."""
import re

P = "/Users/josemendoza/facturacion-app/facturacion-react"
G = "/Users/josemendoza/Repos/facturacion-react"

missing = []


def copy_new(rel):
    with open(P + "/" + rel, encoding="utf-8") as fh:
        content = fh.read()
    with open(G + "/" + rel, "w", encoding="utf-8") as fh:
        fh.write(content)
    print("copied new", rel)


def patch(rel, pairs, tolerant=True):
    with open(G + "/" + rel, encoding="utf-8") as fh:
        s = fh.read()
    for old, new in pairs:
        if old in s:
            s = s.replace(old, new)
        else:
            missing.append((rel, old[:70]))
    with open(G + "/" + rel, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("patched", rel)


def replace_tokens(rel):
    mapping = [
        ("text-amber-700 dark:text-amber-300", "text-warning"),
        ("text-red-600", "text-danger"),
        ("text-red-700", "text-danger"),
        ("text-emerald-600", "text-success"),
        ("text-emerald-700", "text-success"),
        ("text-amber-600", "text-warning"),
        ("text-amber-700", "text-warning"),
    ]
    with open(G + "/" + rel, encoding="utf-8") as fh:
        s = fh.read()
    for old, new in mapping:
        s = s.replace(old, new)
    with open(G + "/" + rel, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("tokens", rel)


def rename_selects(rel, skip_sr_only=False):
    with open(G + "/" + rel, encoding="utf-8") as fh:
        s = fh.read()
    openings = [m.start() for m in re.finditer(r"<select\b", s)]
    closings = [m.start() for m in re.finditer(r"</select>", s)]
    if len(openings) != len(closings):
        missing.append((rel, "select pairing %s/%s" % (len(openings), len(closings))))
        return
    reps = []
    for o, c in zip(openings, closings):
        if skip_sr_only and "sr-only" in s[o:o + 160]:
            continue
        reps.append((o, o + len("<select"), "<Select"))
        reps.append((c, c + len("</select>"), "</Select>"))
    reps.sort(key=lambda r: r[0], reverse=True)
    for a, b, txt in reps:
        s = s[:a] + txt + s[b:]
    with open(G + "/" + rel, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("selects", rel, len(openings))


def neutralize(rel):
    colors = [
        "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/20",
        "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20",
        "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20",
        "border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40",
    ]
    with open(G + "/" + rel, encoding="utf-8") as fh:
        s = fh.read()
    n = 0
    for c in colors:
        old = '<Card className="%s">' % c
        n += s.count(old)
        s = s.replace(old, "<Card>")
    with open(G + "/" + rel, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("neutralized", rel, n)


# --- new components ---
for f in ["src/components/ui/select.tsx", "src/components/ui/empty-state.tsx",
          "src/components/ui/section-title.tsx", "src/components/ui/info-callout.tsx"]:
    copy_new(f)

# --- shared primitives ---
patch("src/components/ui/button.tsx", [(
    '        ghost: "hover:bg-accent hover:text-accent-foreground",\n',
    '        ghost: "hover:bg-accent hover:text-accent-foreground",\n'
    "        destructive:\n"
    '          "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70",\n',
)])
patch("src/components/forms/field.tsx", [(
    '{error ? <span className="text-xs text-red-600">{error}</span> : null}',
    '{error ? <span className="text-xs text-danger">{error}</span> : null}',
)])
patch("src/styles/index.css", [(
    "  .step-indicator-custom button {",
    "  .text-danger {\n    @apply text-red-600 dark:text-red-400;\n  }\n\n"
    "  .text-success {\n    @apply text-emerald-600 dark:text-emerald-400;\n  }\n\n"
    "  .text-warning {\n    @apply text-amber-600 dark:text-amber-400;\n  }\n\n"
    "  .step-indicator-custom button {",
)])

print(">>> shared done; missing so far:", missing)
