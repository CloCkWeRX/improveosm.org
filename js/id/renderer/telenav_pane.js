iD.TelenavPane = function(context) {
    //var id;
    var enable = false,
        div;

    function render(selection) {
    }

    render.enable = function(_) {
        if (!arguments.length) return enable;
        enable = _;
        return render;
    };

    render.dimensions = function(_) {
        if (!arguments.length) return svg.dimensions();
        //svg.dimensions(_);
        return render;
    };

    return render;

/*
telenavPane.entityID = function(_) {
    if (!arguments.length) return id;
    id = _;
    return telenavPane;
};

return telenavPane;
*/
};
