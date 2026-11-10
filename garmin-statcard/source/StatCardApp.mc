import Toybox.Application;
import Toybox.WatchUi;

class StatCardApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        var view = new StatCardView();
        return [view, new StatCardDelegate(view)];
    }

    // Settings edited from the phone take effect immediately.
    function onSettingsChanged() {
        WatchUi.requestUpdate();
    }
}
