iD.ui.TelenavPane = function(context) {
    var id;

    function telenavPane(selection) {
        var entity = context.entity(id);

        selection.style('display', entity.isNew() ? 'none' : null);

        var $statusContainer = selection.selectAll('#STATUS')
            .data([0]);

        $statusContainer.enter()
            .append('div')
            .attr('id', 'STATUS')
            .attr('class', 'tel_displayBlock')
            .text('Reported Status');

        var $statusForm = $statusContainer.append('form')
            .attr('class', 'filterForm');

        var $statusDivOpen = $statusForm.append('div')
            .attr('class', 'tel_displayInline');
        var $statusLabelOpen = $statusDivOpen.append('label')
            .attr('for', 'OPEN')
            .text('open');

        var statusInputOpen = $statusDivOpen.append('input')
            .attr('type', 'radio')
            .attr('id', 'OPEN')
            .attr('class', 'filterItem')
            .attr('name', 'filter');
        var $statusDivSolved = $statusForm.append('div')
            .attr('class', 'tel_displayInline');
        var $statusLabelSolved = $statusDivSolved.append('label')
            .attr('for', 'SOLVED')
            .text('solved');

        var statusInputSolved = $statusLabelSolved.append('input')
            .attr('type', 'radio')
            .attr('id', 'SOLVED')
            .attr('class', 'filterItem')
            .attr('name', 'filter');

        var $statusDivInvalid = $statusForm.append('div')
            .attr('class', 'tel_displayInline');
        var $statusLabelInvalid = $statusDivInvalid.append('label')
            .attr('for', 'INVALID')
            .text('invalid');

        var statusInputInvalid = $statusDivInvalid.append('input')
            .attr('type', 'radio')
            .attr('id', 'INVALID')
            .attr('class', 'filterItem')
            .attr('name', 'filter');

        var $directionFilterContainer = selection.selectAll('#DIRECTION_FILTER')
            .data([0]);
        $directionFilterContainer.enter()
            .append('div')
            .attr('id', 'DIRECTION_FILTER')
            .attr('class', 'tel_displayBlock')

            .append('input')
            .attr('type', 'checkbox')
            .attr('class', 'filterActivation')
            .attr('id', 'oneWayConfidence');

        var $directionFilterLabel = $directionFilterContainer.append('label')
            .attr('class', 'sectionHeader')
            .attr('for', 'oneWayConfidence')
            .text('One-way confidence');

        var $directionFilterForm = $directionFilterContainer.append('form')
            .attr('class', 'typeForm');
        var $direction_highlyProbableContainer = $directionFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $direction_highlyProbableContainer.append('input')
            .attr('id', 'C1')
            .attr('type', 'checkbox');
        $direction_highlyProbableContainer.append('label')
            .attr('for', 'C1')
            .text('Highly Probable');
        var $direction_mostLikelyContainer = $directionFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $direction_mostLikelyContainer.append('input')
            .attr('id', 'C2')
            .attr('type', 'checkbox');
        $direction_mostLikelyContainer.append('label')
            .attr('for', 'C2')
            .text('Most Likely');
        var $direction_probableContainer = $directionFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $direction_probableContainer.append('input')
            .attr('id', 'C3')
            .attr('type', 'checkbox');
        $direction_probableContainer.append('label')
            .attr('for', 'C3')
            .text('Probable');

        var $missingFilterContainer = selection.selectAll('#MISSING_FILTER')
            .data([0]);
        $missingFilterContainer.enter()
            .append('div')
            .attr('id', 'MISSING_FILTER')
            .attr('class', 'tel_displayBlock')

            .append('input')
            .attr('type', 'checkbox')
            .attr('class', 'filterActivation')
            .attr('id', 'missingRoadType');

        var $missingFilterLabel = $missingFilterContainer.append('label')
            .attr('class', 'sectionHeader')
            .attr('for', 'missingRoadType')
            .text('Missing road type');

        var $missingFilterForm = $missingFilterContainer.append('form')
            .attr('class', 'typeForm');
        var $missing_roadContainer = $missingFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $missing_roadContainer.append('input')
            .attr('id', 'ROAD')
            .attr('type', 'checkbox');
        $missing_roadContainer.append('label')
            .attr('for', 'ROAD')
            .text('Road');
        var $missing_parkingContainer = $missingFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $missing_parkingContainer.append('input')
            .attr('id', 'PARKING')
            .attr('type', 'checkbox');
        $missing_parkingContainer.append('label')
            .attr('for', 'PARKING')
            .text('Parking');
        var $missing_bothContainerContainer = $missingFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $missing_bothContainerContainer.append('input')
            .attr('id', 'BOTH')
            .attr('type', 'checkbox');
        $missing_bothContainerContainer.append('label')
            .attr('for', 'BOTH')
            .text('Both');

        $missingFilterForm.append('p')
            .attr('class', 'sectionHeader tel_displayBlock')
            .text('Filters');

        var $missing_waterContainer = $missingFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $missing_waterContainer.append('input')
            .attr('id', 'WATER')
            .attr('type', 'checkbox');
        $missing_waterContainer.append('label')
            .attr('for', 'WATER')
            .text('Water Trail');

        var $missing_pathContainer = $missingFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $missing_pathContainer.append('input')
            .attr('id', 'PATH')
            .attr('type', 'checkbox');
        $missing_pathContainer.append('label')
            .attr('for', 'PATH')
            .text('Path Trail');

        var $restrictionFilterContainer = selection.selectAll('#RESTRICTION_FILTER')
            .data([0]);
        $restrictionFilterContainer.enter()
            .append('div')
            .attr('id', 'RESTRICTION_FILTER')
            .attr('class', 'tel_displayBlock')

            .append('input')
            .attr('type', 'checkbox')
            .attr('class', 'filterActivation')
            .attr('id', 'turnRestrictionConfidence');

        var $restrictionFilterLabel = $restrictionFilterContainer.append('label')
            .attr('class', 'sectionHeader')
            .attr('for', 'turnRestrictionConfidence')
            .text('Turn Restriction confidence');

        var $restrictionFilterForm = $restrictionFilterContainer.append('form')
            .attr('class', 'typeForm');

        var $restriction_highlyProbableContainer = $restrictionFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $restriction_highlyProbableContainer.append('input')
            .attr('id', 'C1')
            .attr('type', 'checkbox');
        $restriction_highlyProbableContainer.append('label')
            .attr('for', 'C1')
            .text('Highly Probable');

        var $restriction_probableContainer = $restrictionFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $restriction_probableContainer.append('input')
            .attr('id', 'C2')
            .attr('type', 'checkbox');
        $restriction_probableContainer.append('label')
            .attr('for', 'C2')
            .text('Probable');

    }

    telenavPane.entityID = function(_) {
        if (!arguments.length) return id;
        id = _;
        return telenavPane;
    };

    return telenavPane;
};
