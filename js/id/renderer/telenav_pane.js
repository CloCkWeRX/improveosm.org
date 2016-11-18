iD.TelenavPane = function() {
    var enable = false;

    function render() {
    }

    render.enable = function(_) {
        if (!arguments.length) return enable;
        enable = _;
        return render;
    };

    render.dimensions = function() {
        return render;
    };

    return render;
};
