iD.ui.Sidebar = function(context) {
    var inspector = iD.ui.Inspector(context),
        current;

    function sidebar(selection) {
        var text = '<img src="https://strava.github.io/api/images/logo.png" style="height: 24px">';
        text += '<div style="float:right; font-weight: bold; margin-top: 3px">Includes the <a href="http://labs.strava.com/slide" target="_blank">Slide add-on</a> &nbsp; </div>';
        selection.append('div')
            .style({position: 'absolute', 'z-index': 1000, width: '400px'})
            .html(text);

        var featureListWrap = selection.append('div')
            .attr('class', 'feature-list-pane')
            .call(iD.ui.FeatureList(context));

        selection.call(iD.ui.Notice(context));

        var inspectorWrap = selection.append('div')
            .attr('class', 'inspector-hidden inspector-wrap fr');

        function hover(id) {
            if (!current && context.hasEntity(id)) {
                featureListWrap.classed('inspector-hidden', true);
                inspectorWrap.classed('inspector-hidden', false)
                    .classed('inspector-hover', true);

                if (inspector.entityID() !== id || inspector.state() !== 'hover') {
                    inspector
                        .state('hover')
                        .entityID(id);

                    inspectorWrap.call(inspector);
                }
            } else if (!current) {
                featureListWrap.classed('inspector-hidden', false);
                inspectorWrap.classed('inspector-hidden', true);
                inspector.state('hide');
            }
        }

        sidebar.hover = _.throttle(hover, 200);

        sidebar.select = function(id, newFeature) {
            if (!current && id) {
                featureListWrap.classed('inspector-hidden', true);
                inspectorWrap.classed('inspector-hidden', false)
                    .classed('inspector-hover', false);

                if (inspector.entityID() !== id || inspector.state() !== 'select') {
                    inspector
                        .state('select')
                        .entityID(id)
                        .newFeature(newFeature);

                    inspectorWrap.call(inspector);
                }
            } else if (!current) {
                featureListWrap.classed('inspector-hidden', false);
                inspectorWrap.classed('inspector-hidden', true);
                inspector.state('hide');
            }
        };

        sidebar.show = function(component) {
            featureListWrap.classed('inspector-hidden', true);
            inspectorWrap.classed('inspector-hidden', true);
            if (current) current.remove();
            current = selection.append('div')
                .attr('class', 'sidebar-component')
                .call(component);
        };

        sidebar.hide = function() {
            featureListWrap.classed('inspector-hidden', false);
            inspectorWrap.classed('inspector-hidden', true);
            if (current) current.remove();
            current = null;
        };
    }

    sidebar.hover = function() {};
    sidebar.hover.cancel = function() {};
    sidebar.select = function() {};
    sidebar.show = function() {};
    sidebar.hide = function() {};

    return sidebar;
};
