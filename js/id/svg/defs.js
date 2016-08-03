/*
    A standalone SVG element that contains only a `defs` sub-element. To be
    used once globally, since defs IDs must be unique within a document.
*/
iD.svg.Defs = function(context) {

    function SVGSpriteDefinition(id, href) {
        return function(defs) {
            d3.xml(href, 'image/svg+xml', function(err, svg) {
                if (err) return;
                defs.node().appendChild(
                    d3.select(svg.documentElement).attr('id', id).node()
                );
            });
        };
    }

    return function (selection) {
        var defs = selection.append('defs');

        // marker
        defs.append('marker')
            .attr({
                id: 'oneway-marker',
                viewBox: '0 0 10 10',
                refY: 2.5,
                refX: 5,
                markerWidth: 2,
                markerHeight: 2,
                markerUnits: 'strokeWidth',
                orient: 'auto'
            })
            .append('path')
            .attr('class', 'oneway')
            .attr('d', 'M 5 3 L 0 3 L 0 2 L 5 2 L 5 0 L 10 2.5 L 5 5 z')
            .attr('stroke', 'none')
            .attr('fill', '#000')
            .attr('opacity', '0.5');

        // red arrow
        defs.append('marker')
            .attr({
                id: 'telenav-arrow-red',
                viewBox: '0 0 3 3',
                refY: 1,
                refX: 1,
                markerWidth: 3,
                markerHeight: 3,
                orient: 'auto'
            })
            .append('path')
                .attr('class', 'telenav-arrow-red')
                .attr('d', 'M0,0 L0,2 L3,1 z')
                .attr('fill', '#f00');

        // green arrow
        defs.append('marker')
            .attr({
                id: 'telenav-arrow-green',
                viewBox: '0 0 3 3',
                refY: 1,
                refX: 1,
                markerWidth: 3,
                markerHeight: 3,
                orient: 'auto'
            })
            .append('path')
                .attr('class', 'telenav-arrow-green')
                .attr('d', 'M0,0 L0,2 L3,1 z')
                .attr('fill', '#00CD00');

        defs.append('marker')
            .attr({
                id: 'telenav-arrow-orange',
                viewBox: '0 0 3 3',
                refY: 1,
                refX: 1,
                markerWidth: 3,
                markerHeight: 3,
                orient: 'auto'
            })
            .append('path')
                .attr('class', 'telenav-arrow-orange')
                .attr('d', 'M0,0 L0,2 L3,1 z')
                .attr('fill', '#EE7600');

        defs.append('marker')
            .attr({
                id: 'telenav-arrow-purple',
                viewBox: '0 0 3 3',
                refY: 1,
                refX: 1,
                markerWidth: 3,
                markerHeight: 3,
                orient: 'auto'
            })
            .append('path')
                .attr('class', 'telenav-arrow-purple')
                .attr('d', 'M0,0 L0,2 L3,1 z')
                .attr('fill', '#DC143C');

        defs.append('marker')
            .attr({
                id: 'telenav-arrow-black',
                viewBox: '0 0 3 3',
                refY: 1,
                refX: 1,
                markerWidth: 3,
                markerHeight: 3,
                orient: 'auto'
            })
            .append('path')
                .attr('class', 'telenav-arrow-black')
                .attr('d', 'M0,0 L0,2 L3,1 z')
                .attr('fill', '#000');

        // patterns
        var patterns = defs.selectAll('pattern')
            .data([
                // pattern name, pattern image name
                ['wetland', 'wetland'],
                ['construction', 'construction'],
                ['cemetery', 'cemetery'],
                ['orchard', 'orchard'],
                ['farmland', 'farmland'],
                ['beach', 'dots'],
                ['scrub', 'dots'],
                ['meadow', 'dots']
            ])
            .enter()
            .append('pattern')
            .attr({
                id: function (d) {
                    return 'pattern-' + d[0];
                },
                width: 32,
                height: 32,
                patternUnits: 'userSpaceOnUse'
            });

        patterns.append('rect')
            .attr({
                x: 0,
                y: 0,
                width: 32,
                height: 32,
                'class': function (d) {
                    return 'pattern-color-' + d[0];
                }
            });

        patterns.append('image')
            .attr({
                x: 0,
                y: 0,
                width: 32,
                height: 32
            })
            .attr('xlink:href', function (d) {
                return context.imagePath('pattern/' + d[1] + '.png');
            });

        // clip paths
        defs.selectAll()
            .data([12, 18, 20, 32, 45])
            .enter().append('clipPath')
            .attr('id', function (d) {
                return 'clip-square-' + d;
            })
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', function (d) {
                return d;
            })
            .attr('height', function (d) {
                return d;
            });

        defs.call(SVGSpriteDefinition(
            'iD-sprite',
            context.imagePath('iD-sprite.svg')));

        defs.call(SVGSpriteDefinition(
            'maki-sprite',
            context.imagePath('maki-sprite.svg')));
    };
};
