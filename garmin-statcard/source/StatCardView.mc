import Toybox.Attention;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.System;
import Toybox.WatchUi;

// Page 0: Strava profile QR. Page 1: stats card.
class StatCardView extends WatchUi.View {

    const PAGES = 2;

    hidden var _page = 0;
    // Encoded QR, re-encoded only when the text changes.
    hidden var _qrText = null;
    hidden var _qr = null;

    function initialize() {
        View.initialize();
    }

    function onShow() {
        lightUp();
    }

    function turnPage(step) {
        _page = (_page + step + PAGES) % PAGES;
        lightUp();
        WatchUi.requestUpdate();
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        if (_page == 0) {
            var url = Stats.setting("stravaUrl");
            if (url.length() == 0) {
                drawLines(dc, "Strava", ["Add your profile", "link in the app", "settings"]);
            } else {
                drawQr(dc, "Strava", url);
            }
        } else {
            drawLines(dc, Stats.title(), Stats.lines(Stats.collect()));
        }
    }

    hidden function drawQr(dc, title, text) {
        if (!text.equals(_qrText)) {
            _qr = QrCode.encode(text.toUtf8Array());
            _qrText = text;
        }
        var rows = _qr;
        if (rows == null) {
            drawLines(dc, title, ["Too long for", "a QR code"]);
            return;
        }

        // Largest square that fits the screen (inside the circle on round watches),
        // with a 2-module light border so phone cameras can find the code.
        var w = dc.getWidth();
        var h = dc.getHeight();
        var box = (w < h) ? w : h;
        if (System.getDeviceSettings().screenShape == System.SCREEN_SHAPE_RECTANGLE) {
            box = box * 80 / 100;
        } else {
            box = box * 70 / 100;
        }
        var size = rows.size();
        var quiet = 2;
        var scale = box / (size + 2 * quiet);
        if (scale < 1) {
            scale = 1;
        }
        var side = scale * (size + 2 * quiet);
        var x0 = (w - side) / 2;
        var y0 = (h - side) / 2;

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_WHITE);
        dc.fillRectangle(x0, y0, side, side);
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_WHITE);
        var ox = x0 + quiet * scale;
        var oy = y0 + quiet * scale;
        for (var y = 0; y < size; y++) {
            var row = rows[y];
            var x = 0;
            while (x < size) {
                if (row[x]) {
                    // Draw each horizontal run of dark modules as one rectangle.
                    var start = x;
                    while (x < size && row[x]) {
                        x++;
                    }
                    dc.fillRectangle(ox + start * scale, oy + y * scale, (x - start) * scale, scale);
                } else {
                    x++;
                }
            }
        }

        var font = Graphics.FONT_XTINY;
        var ty = y0 - dc.getFontHeight(font);
        if (ty < 0) {
            ty = 0;
        }
        dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, ty, font, title, Graphics.TEXT_JUSTIFY_CENTER);
    }

    // Orange title followed by white lines, centred on the screen.
    hidden function drawLines(dc, title, lines) {
        var font = Graphics.FONT_XTINY;
        var lh = dc.getFontHeight(font);
        var cx = dc.getWidth() / 2;
        var y = (dc.getHeight() - (lines.size() + 1) * lh) / 2;
        dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, y, font, title, Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        for (var i = 0; i < lines.size(); i++) {
            y += lh;
            dc.drawText(cx, y, font, lines[i], Graphics.TEXT_JUSTIFY_CENTER);
        }
    }

    // Keep the screen lit so the code is easy to scan.
    hidden function lightUp() {
        if (Attention has :backlight) {
            try {
                Attention.backlight(true);
            } catch (e) {
                // Some AMOLED watches limit backlight use; scanning still works.
            }
        }
    }
}
