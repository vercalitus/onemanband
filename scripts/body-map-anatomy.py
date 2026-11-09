"""Areas and their parts over the two Servier figures, in image pixels.

Every polygon is drawn for the viewer's LEFT half and mirrored. Fills are
clipped to the figure's silhouette in the app, so outer edges may run past the
body; inner edges follow the anatomy drawn in the figure.

An area is a list of parts. A part named None is the area itself (an area that
does not break down). Parts of a midline area that come in pairs get a side
suffix (-r / -l); the side follows the figure (front: our left is the
patient's right).
"""
import json, sys

MIRROR = 515
MID = 257.5


def R(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def bands(levels, x0, x1, y0, y1):
    step = (y1 - y0) / len(levels)
    return [(lv, R(x0, y0 + i * step, x1, y0 + (i + 1) * step)) for i, lv in enumerate(levels)]


C = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"]
T_UP = ["T1", "T2", "T3", "T4", "T5", "T6"]
T_LO = ["T7", "T8", "T9", "T10", "T11", "T12"]
L = ["L1", "L2", "L3", "L4", "L5"]

# kind: "side" = one per side, mirrored; "mid" = one area on the midline whose
# parts are listed as (part, poly, paired) — paired parts are mirrored with a
# side suffix, unpaired ones sit on the midline.

FRONT = [
    ("forehead", "mid", [(None, [(195, 12), (320, 12), (320, 96), (195, 96)], False)]),
    ("temple", "side", [(None, [(178, 60), (212, 60), (212, 128), (182, 132)])]),
    ("jaw", "side", [
        ("tmj", [(182, 132), (212, 128), (215, 162), (190, 168)]),
        ("cheek", [(212, 96), (257.5, 96), (257.5, 150), (215, 150), (212, 128)]),
        ("jawline", [(190, 168), (215, 150), (257.5, 150), (257.5, 208), (215, 205)]),
    ]),
    ("neckFront", "mid", [
        ("scalenes", [(170, 214), (205, 205), (222, 252), (165, 256)], True),
        ("scm", [(205, 205), (238, 200), (247, 254), (222, 252)], True),
        ("throat", [(238, 200), (277, 200), (268, 254), (247, 254)], False),
    ]),
    ("shoulder", "side", [
        ("acJoint", [(122, 250), (168, 246), (172, 272), (128, 278)]),
        ("anteriorDeltoid", [(55, 300), (90, 262), (128, 278), (172, 272), (180, 345), (165, 382), (60, 372)]),
    ]),
    ("chest", "side", [
        ("clavicle", [(168, 246), (257.5, 254), (257.5, 274), (172, 272)]),
        ("pecMajor", [(172, 272), (240, 274), (242, 392), (205, 405), (182, 372), (180, 345)]),
        ("sternum", [(240, 274), (257.5, 274), (257.5, 405), (242, 405), (242, 392)]),
        ("ribs", [(140, 382), (165, 382), (182, 372), (205, 405), (205, 525), (140, 525)]),
    ]),
    ("upperAbdomen", "mid", [
        ("upperRectus", [(205, 405), (240, 405), (240, 560), (205, 560)], True),
        ("epigastric", [(240, 405), (275, 405), (275, 560), (240, 560)], False),
    ]),
    ("lowerAbdomen", "side", [
        ("flank", [(140, 525), (205, 525), (205, 600), (180, 615), (150, 600)]),
        ("lowerRectus", [(205, 560), (257.5, 560), (257.5, 692), (180, 655), (180, 615), (205, 600)]),
    ]),
    ("hipFront", "side", [
        ("asis", [(140, 590), (150, 600), (180, 615), (180, 655), (160, 650), (135, 630)]),
        ("tfl", [(115, 630), (135, 630), (160, 650), (172, 700), (150, 785), (115, 785)]),
    ]),
    ("groin", "side", [
        ("hipFlexor", [(160, 650), (180, 655), (257.5, 692), (257.5, 715), (215, 720), (172, 700)]),
        ("adductorOrigin", [(172, 700), (215, 720), (257.5, 715), (257.5, 790), (220, 780)]),
    ]),
    ("thighFront", "side", [
        ("vastusLateralis", [(115, 785), (150, 785), (162, 820), (158, 945), (115, 945)]),
        ("quadriceps", [(150, 785), (172, 700), (220, 780), (225, 900), (215, 945), (158, 945), (162, 820)]),
        ("adductors", [(220, 780), (257.5, 790), (257.5, 945), (215, 945), (225, 900)]),
    ]),
    ("knee", "side", [
        ("lateralKnee", [(115, 945), (175, 945), (175, 1035), (115, 1035)]),
        ("patella", [(175, 945), (220, 945), (220, 1008), (175, 1008)]),
        ("patellarTendon", [(175, 1008), (220, 1008), (220, 1035), (175, 1035)]),
        ("medialKnee", [(220, 945), (257.5, 945), (257.5, 1035), (220, 1035)]),
    ]),
    ("shin", "side", [
        ("tibialisAnterior", [(115, 1035), (200, 1035), (198, 1225), (115, 1225)]),
        ("tibia", [(200, 1035), (257.5, 1035), (257.5, 1225), (198, 1225)]),
    ]),
    ("ankle", "side", [
        ("lateralMalleolus", [(115, 1225), (207, 1225), (207, 1285), (115, 1285)]),
        ("anteriorAnkle", [(207, 1225), (232, 1225), (232, 1285), (207, 1285)]),
        ("medialMalleolus", [(232, 1225), (257.5, 1225), (257.5, 1285), (232, 1285)]),
    ]),
    ("foot", "side", [
        ("topOfFoot", R(115, 1285, 257.5, 1322)),
        ("toes", R(115, 1322, 257.5, 1360)),
    ]),
    ("upperArm", "side", [(None, [(25, 372), (60, 372), (140, 380), (140, 482), (25, 482)])]),
    ("elbow", "side", [
        ("lateralEpicondyle", R(15, 482, 72, 560)),
        ("cubitalFossa", R(72, 482, 112, 560)),
        ("medialEpicondyle", R(112, 482, 140, 560)),
    ]),
    ("forearm", "side", [
        ("brachioradialis", R(10, 560, 72, 668)),
        ("flexors", R(72, 560, 140, 668)),
    ]),
    ("wrist", "side", [(None, R(10, 668, 112, 718))]),
    ("hand", "side", [
        ("thenar", R(0, 718, 52, 772)),
        ("palm", R(52, 718, 112, 772)),
        ("fingers", R(0, 772, 112, 825)),
    ]),
]

BACK = [
    ("occiput", "side", [(None, [(180, 30), (257.5, 30), (257.5, 160), (205, 160), (182, 140)])]),
    ("neckBack", "side", [
        ("levatorScapulae", [(182, 140), (205, 160), (232, 160), (232, 232), (200, 232), (190, 200)]),
        *bands(C, 232, 257.5, 160, 232),
    ]),
    ("upperTrapezius", "side", [(None, [(140, 252), (200, 232), (232, 232), (232, 262), (212, 262), (150, 272)])]),
    ("shoulderBlade", "side", [
        ("supraspinatus", [(150, 272), (212, 262), (215, 300), (165, 296)]),
        ("infraspinatus", [(165, 296), (215, 300), (215, 375), (178, 372), (168, 340)]),
        ("teres", [(168, 340), (178, 372), (215, 375), (215, 418), (175, 405)]),
    ]),
    ("betweenShoulderBlades", "mid", [
        ("rhomboid", [(215, 262), (237, 262), (237, 432), (215, 432)], True),
        *[(f"{lv}", poly, True) for lv, poly in bands(T_UP, 237, 257.5, 232, 432)],
    ]),
    ("midBack", "side", [
        ("lats", [(140, 405), (175, 405), (215, 418), (215, 432), (237, 432), (237, 540), (140, 540)]),
        *bands(T_LO, 237, 257.5, 432, 540),
    ]),
    ("lowerBack", "side", [
        ("ql", R(140, 540, 237, 612)),
        *bands(L, 237, 257.5, 540, 612),
    ]),
    ("sacrum", "mid", [(None, [(237, 612), (278, 612), (270, 690), (257.5, 735), (245, 690)], False)]),
    ("coccyx", "mid", [(None, [(245, 735), (270, 735), (264, 778), (251, 778)], False)]),
    ("siJoint", "side", [(None, [(205, 612), (237, 612), (245, 690), (215, 690)])]),
    ("buttock", "side", [
        ("gluteusMedius", [(160, 612), (205, 612), (215, 690), (195, 672), (160, 680)]),
        ("piriformis", [(160, 680), (195, 672), (215, 690), (245, 690), (250, 712), (160, 722)]),
        ("gluteusMaximus", [(160, 722), (250, 712), (257.5, 735), (251, 778), (257.5, 805), (160, 805)]),
    ]),
    ("hipLateral", "side", [
        ("greaterTrochanter", R(115, 612, 160, 720)),
        ("itbUpper", R(115, 720, 160, 805)),
    ]),
    ("thighBack", "side", [
        ("itb", R(115, 805, 148, 968)),
        ("lateralHamstring", R(148, 805, 196, 968)),
        ("medialHamstring", R(196, 805, 257.5, 968)),
    ]),
    ("kneeBack", "side", [(None, R(115, 968, 257.5, 1040))]),
    ("calf", "side", [
        ("gastrocLateral", R(115, 1040, 192, 1135)),
        ("gastrocMedial", R(192, 1040, 257.5, 1135)),
        ("soleus", R(115, 1135, 257.5, 1185)),
    ]),
    ("ankleBack", "side", [
        ("lateralMalleolus", R(115, 1185, 200, 1268)),
        ("achilles", R(200, 1185, 228, 1268)),
        ("medialMalleolus", R(228, 1185, 257.5, 1268)),
    ]),
    ("heel", "side", [(None, R(115, 1268, 257.5, 1335))]),
    ("shoulderBack", "side", [
        ("lateralDeltoid", [(55, 300), (90, 262), (110, 256), (112, 372), (60, 372)]),
        ("posteriorDeltoid", [(110, 256), (140, 252), (150, 272), (165, 296), (168, 340), (175, 405), (140, 405), (140, 382), (112, 372)]),
    ]),
    ("upperArmBack", "side", [(None, [(25, 372), (112, 372), (140, 382), (140, 482), (25, 482)])]),
    ("elbowBack", "side", [
        ("lateralEpicondyle", R(15, 482, 62, 560)),
        ("olecranon", R(62, 482, 100, 560)),
        ("medialEpicondyle", R(100, 482, 140, 560)),
    ]),
    ("forearmBack", "side", [(None, R(10, 560, 140, 668))]),
    ("wristBack", "side", [(None, R(10, 668, 112, 718))]),
    ("handBack", "side", [
        ("backOfHand", R(0, 718, 112, 772)),
        ("fingers", R(0, 772, 112, 825)),
    ]),
]


# ── The soles ──────────────────────────────────────────────────────────────
# Neither Servier figure shows the underside of the foot, where a heel spur,
# plantar fasciitis, metatarsalgia and a Morton's neuroma are found. So the
# soles are drawn here and placed on the back figure, in the empty space
# beside each foot: public/body-map/back-soles.svg is laid over back.webp.
# Seen from below with the patient's back to us, like the rest of the back
# figure: our left is the patient's left. Toes at the top, heel at the bottom.
#
# The foot is drawn in its own pixels (left foot around x 60-250, y 0-330) and
# placed with one scale and offset, so the drawing and its parts move together.

SOLE_SCALE = 0.75
SOLE_DX = 68 - 158 * SOLE_SCALE  # the foot's middle lands at x 68
SOLE_DY = 1095 - 18 * SOLE_SCALE  # its toes at y 1095, its heel at the bottom


def place(poly):
    return [(SOLE_DX + x * SOLE_SCALE, SOLE_DY + y * SOLE_SCALE) for x, y in poly]

# The left foot's outline without the toes, clockwise from the heel. The big
# toe is on the inner side, toward the middle of the picture.
FOOT = [
    (150, 318), (178, 312), (194, 296), (200, 272), (196, 245), (188, 222),
    (184, 200), (186, 178), (196, 156), (212, 136), (226, 120), (234, 104),
    (232, 92), (214, 88), (196, 92), (178, 94), (160, 97), (140, 101),
    (120, 107), (100, 114), (86, 122), (82, 145), (86, 180), (94, 215),
    (104, 250), (112, 280), (126, 305), (140, 316),
]
# (cx, cy, rx, ry) — big toe first, then outward.
TOES = [(213, 62, 20, 30), (178, 72, 12, 20), (154, 78, 11, 18), (130, 86, 10, 16), (107, 98, 9, 14)]

TOE_LINE = [(250, 96), (214, 92), (196, 96), (178, 98), (160, 101), (140, 105), (120, 111), (100, 118), (86, 126), (60, 132)]


def ball_y(x):
    """The lower edge of the ball of the foot: under the metatarsal heads."""
    return 148 + (250 - x) * 0.116


def toe_y(x):
    pts = TOE_LINE
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x1 <= x <= x0:
            return y0 + (y1 - y0) * (x0 - x) / (x0 - x1)
    return pts[0][1] if x > pts[0][0] else pts[-1][1]


def strip(top, bottom, xa, xb):
    """The band between two edges, from x = xa (outer) to xb (inner)."""
    xs = sorted({xa, xb, *[x for x, _ in TOE_LINE if xa < x < xb]})
    upper = [(x, top(x)) for x in xs]
    lower = [(x, bottom(x)) for x in reversed(xs)]
    return upper + lower


HEEL_Y = 240

# First in the back figure's list: where a sole's generous edge meets a leg's,
# the sole wins — the leg is not drawn there.
SOLES = [
    ("sole", "side", [(part, place(poly)) for part, poly in [
        ("hallux", [(193, 0), (250, 0), (250, toe_y(250)), (193, toe_y(193))]),
        ("lesserToes", [(60, 0), (193, 0), *[(x, toe_y(x)) for x in [193, 178, 160, 140, 120, 100, 86, 60]]]),
        ("firstMtp", strip(toe_y, ball_y, 193, 250)),
        ("centralMetatarsals", strip(toe_y, ball_y, 150, 193)),
        ("mortonSpace", strip(toe_y, ball_y, 134, 150)),
        ("lateralMetatarsals", strip(toe_y, ball_y, 60, 134)),
        ("medialArch", strip(ball_y, lambda x: HEEL_Y, 150, 250)),
        ("lateralFoot", strip(ball_y, lambda x: HEEL_Y, 60, 150)),
        ("plantarHeel", R(60, HEEL_Y, 250, 330)),
    ]]),
]


def smooth(points):
    """A closed Catmull-Rom curve through the points, as an SVG path."""
    n = len(points)
    d = f"M{points[0][0]:g},{points[0][1]:g}"
    for i in range(n):
        p0, p1, p2, p3 = points[i - 1], points[i], points[(i + 1) % n], points[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:g},{p2[1]:g}"
    return d + "Z"


def emit_soles_svg(path):
    w, h = 516, 1329  # the back figure's own size, so the two stack exactly

    def foot(flip):
        fx = (lambda x: MIRROR - x) if flip else (lambda x: x)
        outline = [(fx(x), y) for x, y in (reversed(FOOT) if flip else FOOT)]
        clip = "r" if flip else "l"
        d = smooth(outline)
        g = [
            f'<clipPath id="sole-{clip}"><path d="{d}"/></clipPath>',
            f'<path d="{d}" fill="#f1c6ab"/>',
            # Pads where the foot bears weight, and the hollow of the arch —
            # kept inside the outline, which is drawn over them.
            f'<g clip-path="url(#sole-{clip})">',
            f'<ellipse cx="{fx(152)}" cy="282" rx="34" ry="28" fill="#e7ad92" opacity=".75"/>',
            f'<ellipse cx="{fx(160)}" cy="126" rx="70" ry="18" transform="rotate({-9 if not flip else 9} {fx(160)} 126)" fill="#e7ad92" opacity=".7"/>',
            f'<ellipse cx="{fx(204)}" cy="190" rx="14" ry="40" fill="#f8dccb" opacity=".9"/>',
            "</g>",
            f'<path d="{d}" fill="none" stroke="#b9775b" stroke-width="2"/>',
        ]
        for cx, cy, rx, ry in TOES:
            g.append(
                f'<ellipse cx="{fx(cx)}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#f1c6ab" stroke="#b9775b" stroke-width="2"/>'
            )
            g.append(f'<ellipse cx="{fx(cx)}" cy="{cy - ry * 0.2:.1f}" rx="{rx * 0.6:.1f}" ry="{ry * 0.5:.1f}" fill="#e7ad92" opacity=".7"/>')
        return "".join(g)

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        "<!-- Generated by scripts/body-map-anatomy.py -->"
        f'<g transform="translate({SOLE_DX:g},{SOLE_DY:g}) scale({SOLE_SCALE:g})">{foot(False)}</g>'
        # The right foot is drawn mirrored at x' = 515 - x; this lands it at
        # the mirror of where the left one went.
        f'<g transform="translate({MIRROR - SOLE_DX - MIRROR * SOLE_SCALE:g},{SOLE_DY:g}) scale({SOLE_SCALE:g})">{foot(True)}</g>'
        "</svg>"
    )
    open(path, "w", encoding="utf8", newline=chr(10)).write(svg + chr(10))


def mirror(poly):
    return [(MIRROR - x, y) for x, y in reversed(poly)]


def expand(items, left_side):
    right_side = "l" if left_side == "r" else "r"
    out = []
    for key, kind, parts in items:
        if kind == "side":
            for side, flip in ((left_side, False), (right_side, True)):
                out.append({
                    "key": key, "side": side,
                    "parts": [{"part": p, "poly": mirror(poly) if flip else poly} for p, poly in parts],
                })
        else:
            ps = []
            for p, poly, paired in parts:
                if paired:
                    ps.append({"part": f"{p}-{left_side}", "poly": poly})
                    ps.append({"part": f"{p}-{right_side}", "poly": mirror(poly)})
                else:
                    ps.append({"part": p, "poly": poly})
            out.append({"key": key, "side": None, "parts": ps})
    return out


DATA = {"front": expand(FRONT, "r"), "back": expand(SOLES + BACK, "l")}

def emit_ts(path):
    """Write the module the app reads. Run: python scripts/body-map-anatomy.py"""
    fmt = lambda v: "%g" % round(v, 1)
    lines = [
        "// Generated by scripts/body-map-anatomy.py — edit the polygons there and run it again.",
        "// Polygons are in the figures' own pixels (front 516×1356, back 516×1329).",
        "",
        'import type { BodyMapView } from "@/types/domain"',
        "",
        "export interface AreaShape {",
        "  key: string",
        '  side: "r" | "l" | null',
        "  /** null part: the area does not break down. */",
        "  parts: { part: string | null; points: string }[]",
        "}",
        "",
        "export const ANATOMY: Record<BodyMapView, AreaShape[]> = {",
    ]
    for view in ["front", "back"]:
        lines.append(f"  {view}: [")
        for a in DATA[view]:
            side = f'"{a["side"]}"' if a["side"] else "null"
            lines.append(f'    {{ key: "{a["key"]}", side: {side}, parts: [')
            for p in a["parts"]:
                part = f'"{p["part"]}"' if p["part"] else "null"
                pts = " ".join(f"{fmt(x)},{fmt(y)}" for x, y in p["poly"])
                lines.append(f'      {{ part: {part}, points: "{pts}" }},')
            lines.append("    ] },")
        lines.append("  ],")
    lines.append("}")
    nl = chr(10)
    open(path, "w", encoding="utf8", newline=nl).write(nl.join(lines) + nl)


if __name__ == "__main__":
    if "--json" in sys.argv:
        json.dump(DATA, sys.stdout)
    else:
        emit_ts("src/features/body-map/lib/anatomy-data.ts")
        emit_soles_svg("public/body-map/back-soles.svg")
