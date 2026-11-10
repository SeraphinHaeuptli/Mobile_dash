import Toybox.WatchUi;

// Tap / START, swipe or UP/DOWN cycle through the pages. BACK exits.
class StatCardDelegate extends WatchUi.BehaviorDelegate {

    hidden var _view;

    function initialize(view) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    function onSelect() {
        _view.turnPage(1);
        return true;
    }

    function onNextPage() {
        _view.turnPage(1);
        return true;
    }

    function onPreviousPage() {
        _view.turnPage(-1);
        return true;
    }
}
