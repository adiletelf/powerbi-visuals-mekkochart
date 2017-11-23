/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual.columnChart {
    // powerbi.visuals
    import ISelectionId = powerbi.visuals.ISelectionId;
    import createLinearColorScale = powerbi.extensibility.utils.color.createLinearColorScale;

    // d3
    import Selection = d3.Selection;
    import LinearScale = d3.scale.Linear;

    // powerbi
    import IDataViewObjects = powerbi.DataViewObjects;

    // powerbi.extensibility.utils.dataview
    import converterHelper = powerbi.extensibility.utils.dataview.converterHelper;
    import DataViewObjects = powerbi.extensibility.utils.dataview.DataViewObjects;

    // powerbi.extensibility.utils.svg
    import IMargin = powerbi.extensibility.utils.svg.IMargin;
    import ClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.ClassAndSelector;
    import createClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.createClassAndSelector;

    // powerbi.extensibility.utils.chart
    import AxisHelper = powerbi.extensibility.utils.chart.axis;
    import IAxisProperties = AxisHelper.IAxisProperties;

    // powerbi.extensibility.utils.type
    import Prototype = powerbi.extensibility.utils.type.Prototype;
    import ValueType = powerbi.extensibility.utils.type.ValueType;
    import EnumExtensions = powerbi.extensibility.utils.type.EnumExtensions;
    import ArrayExtensions = powerbi.extensibility.utils.type.ArrayExtensions;

    // powerbi.extensibility.utils.interactivity
    import LegendIcon = powerbi.extensibility.utils.chart.legend.LegendIcon;
    import ILegendData = powerbi.extensibility.utils.chart.legend.LegendData;
    import dataLabelUtils = powerbi.extensibility.utils.chart.dataLabel.utils;
    import LegendDataPoint = powerbi.extensibility.utils.chart.legend.LegendDataPoint;
    import DataLabelObject = powerbi.extensibility.utils.chart.dataLabel.DataLabelObject;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;
    import VisualDataLabelsSettings = powerbi.extensibility.utils.chart.dataLabel.VisualDataLabelsSettings;
    import VisualDataLabelsSettingsOptions = powerbi.extensibility.utils.chart.dataLabel.VisualDataLabelsSettingsOptions;

    // powerbi.extensibility.utils.formatting
    import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import DisplayUnitSystemType = powerbi.extensibility.utils.formatting.DisplayUnitSystemType;

    // powerbi.extensibility.utils.tooltip
    import TooltipEventArgs = powerbi.extensibility.utils.tooltip.TooltipEventArgs;
    import ITooltipServiceWrapper = powerbi.extensibility.utils.tooltip.ITooltipServiceWrapper;
    import TooltipEnabledDataPoint = powerbi.extensibility.utils.tooltip.TooltipEnabledDataPoint;
    import createTooltipServiceWrapper = powerbi.extensibility.utils.tooltip.createTooltipServiceWrapper;

    // powerbi.extensibility.utils.color
    import ColorHelper = powerbi.extensibility.utils.color.ColorHelper;

    // visualStrategy
    import IVisualStrategy = visualStrategy.IVisualStrategy;
    import BaseVisualStrategy = visualStrategy.BaseVisualStrategy;

    // converterStrategy
    import BaseConverterStrategy = converterStrategy.BaseConverterStrategy;

    // formattingUtils
    import getFormattedLegendLabel = formattingUtils.getFormattedLegendLabel;

    // behavior
    import VisualBehaviorOptions = behavior.VisualBehaviorOptions;

    export class BaseColumnChart implements IColumnChart {
        private static ColumnChartClassName: string = "columnChart";

        private static LabelGraphicsContextSelector: ClassAndSelector = createClassAndSelector("labelGraphicsContext");

        private static ColumnChartUnclippedGraphicsContextSelector: ClassAndSelector = createClassAndSelector("columnChartUnclippedGraphicsContext");
        private static ColumnChartMainGraphicsContextSelector: ClassAndSelector = createClassAndSelector("columnChartMainGraphicsContext");

        private static HighlightedKeyPostfix: string = "-highlighted-data-point";

        private static DefaultStackedPosition: number = 0;

        private static ColumSortField: string = "valueOriginal";

        private static Is100Pct: boolean = true;

        private svg: Selection<any>;
        private unclippedGraphicsContext: Selection<any>;
        private mainGraphicsContext: Selection<any>;
        private labelGraphicsContext: Selection<any>;

        private xAxisProperties: IAxisProperties;
        private yAxisProperties: IAxisProperties;

        private currentViewport: IViewport;

        private data: MekkoColumnChartData;

        private colorPalette: IColorPalette;
        private visualHost: IVisualHost;

        private chartType: MekkoVisualChartType;

        private columnChart: IVisualStrategy;

        private cartesianVisualHost: IMekkoChartVisualHost;

        private margin: IMargin;
        private lastInteractiveSelectedColumnIndex: number;
        private supportsOverflow: boolean;
        private interactivityService: IInteractivityService;
        private dataViewCat: DataViewCategorical;
        private categoryAxisType: string = null;
        private isScrollable: boolean;

        private tooltipServiceWrapper: ITooltipServiceWrapper;

        constructor(options: MekkoChartConstructorOptions) {
            this.chartType = options.chartType;
            this.isScrollable = options.isScrollable;
            this.interactivityService = options.interactivityService;
        }

        public init(options: MekkoChartVisualInitOptions) {
            this.svg = options.svg;

            this.unclippedGraphicsContext = this.svg
                .append("g")
                .classed(BaseColumnChart.ColumnChartUnclippedGraphicsContextSelector.className, true);

            this.mainGraphicsContext = this.unclippedGraphicsContext
                .append("svg")
                .classed(BaseColumnChart.ColumnChartMainGraphicsContextSelector.className, true);

            this.labelGraphicsContext = this.svg
                .append("g")
                .classed(BaseColumnChart.LabelGraphicsContextSelector.className, true);

            this.visualHost = options.host;
            this.colorPalette = this.visualHost.colorPalette;

            this.cartesianVisualHost = options.cartesianHost;
            this.supportsOverflow = !EnumExtensions.hasFlag(this.chartType, flagStacked);

            d3.select(options.element)
                .classed(BaseColumnChart.ColumnChartClassName, true);

            this.tooltipServiceWrapper = createTooltipServiceWrapper(
                this.visualHost.tooltipService,
                options.element);

            this.columnChart = new BaseVisualStrategy();
        }

        private getCategoryLayout(
            numCategoryValues: number,
            options: MekkoCalculateScaleAndDomainOptions): MekkoChartCategoryLayout {

            const availableWidth: number = this.currentViewport.width
                - (this.margin.left + this.margin.right),
                metadataColumn: DataViewMetadataColumn = this.data
                    ? this.data.categoryMetadata
                    : undefined,
                categoryDataType: ValueType = AxisHelper.getCategoryValueType(metadataColumn),
                isScalar: boolean = this.data
                    ? this.data.scalarCategoryAxis
                    : false,
                domain: number[] = AxisHelper.createDomain(
                    this.data.series,
                    categoryDataType,
                    isScalar,
                    options.forcedXDomain);

            return MekkoChart.getLayout(
                this.data,
                {
                    domain,
                    isScalar,
                    availableWidth,
                    categoryCount: numCategoryValues,
                    isScrollable: this.isScrollable,
                    trimOrdinalDataOnOverflow: false
                });
        }

        public static getBorderWidth(border: MekkoBorderSettings): number {
            if (!border
                || !border.show
                || !border.width) {
                return 0;
            }

            const width: number = border.width;

            if (width < 0) {
                return 0;
            }

            if (width > border.maxWidth) {
                return border.maxWidth;
            }

            return width;
        }

        public static getBorderColor(border: MekkoBorderSettings): string {
            if (!border) {
                return MekkoChart.DefaultSettings.columnBorder.color;
            }

            return border.color;
        }

        public static converter(
            visualHost: IVisualHost,
            categorical: DataViewCategorical,
            colors: IColorPalette,
            is100PercentStacked: boolean = false,
            isScalar: boolean = false,
            supportsOverflow: boolean = false,
            dataViewMetadata: DataViewMetadata = null,
            chartType?: MekkoVisualChartType): MekkoColumnChartData {

            const xAxisCardProperties: DataViewObject = dataViewUtils.getCategoryAxisProperties(dataViewMetadata);
            const valueAxisProperties: DataViewObject = dataViewUtils.getValueAxisProperties(dataViewMetadata);

            isScalar = dataViewUtils.isScalar(isScalar, xAxisCardProperties);
            categorical = utils.applyUserMinMax(isScalar, categorical, xAxisCardProperties);

            const converterStrategy: BaseConverterStrategy =
                new BaseConverterStrategy(categorical, visualHost);

            const firstCategory: DataViewCategoryColumn = categorical
                && categorical.categories
                && categorical.categories[0],
                categories: PrimitiveValue[] = firstCategory
                    ? firstCategory.values
                    : [],
                categoryIdentities: DataViewScopeIdentity[] = firstCategory
                    ? firstCategory.identity
                    : [],
                categoryMetadata: DataViewMetadataColumn = firstCategory
                    ? firstCategory.source
                    : undefined;

            const categoryFormatter: IValueFormatter = valueFormatter.create({
                format: valueFormatter.getFormatStringByColumn(categoryMetadata),
                value: categories[0],
                value2: categories[categories.length - 1],
                displayUnitSystemType: DisplayUnitSystemType.Verbose
            });

            let borderSettings: MekkoBorderSettings = MekkoChart.DefaultSettings.columnBorder,
                sortSeriesSettings: MekkoSeriesSortSettings = MekkoChart.DefaultSettings.sortSeries,
                sortLegendSettings: MekkoLegendSortSettings = MekkoChart.DefaultSettings.sortLegend,
                xAxisLabelsSettings: MekkoXAxisLabelsSettings = MekkoChart.DefaultSettings.xAxisLabels,
                categoryColumnSettings: MekkoCategoryColorSettings = MekkoChart.DefaultSettings.categoryColor,
                labelSettings: VisualDataLabelsSettings = dataLabelUtils.getDefaultColumnLabelSettings(true),
                dataPointSettings: MekkoDataPointSettings = MekkoChart.DefaultSettings.dataPoint;

            let defaultDataPointColor: string = undefined,
                showAllDataPoints: boolean = undefined;

            if (dataViewMetadata && dataViewMetadata.objects) {
                const objects: IDataViewObjects = dataViewMetadata.objects;

                defaultDataPointColor = DataViewObjects.getFillColor(
                    objects,
                    MekkoChart.Properties["dataPoint"]["defaultColor"]);

                showAllDataPoints = DataViewObjects.getValue<boolean>(
                    objects,
                    MekkoChart.Properties["dataPoint"]["showAllDataPoints"]);

                labelSettings = MekkoChart.parseLabelSettings(objects);
                borderSettings = MekkoChart.parseBorderSettings(objects);
                sortLegendSettings = MekkoChart.parseLegendSortSettings(objects);
                sortSeriesSettings = MekkoChart.parseSeriesSortSettings(objects);
                xAxisLabelsSettings = MekkoChart.parseXAxisLabelsSettings(objects);
                dataPointSettings = MekkoChart.parseDataPointSettings(objects);
            }

            // Allocate colors
            let legendAndSeriesInfo: LegendSeriesInfo = converterStrategy.getLegend(colors, defaultDataPointColor, "", dataPointSettings.categoryGradient, dataPointSettings.colorGradientEndColor.solid.color);
            let legend: MekkoLegendDataPoint[] = legendAndSeriesInfo.legend.dataPoints;

            let seriesSources: DataViewMetadataColumn[] = legendAndSeriesInfo.seriesSources;

            // Determine data points
            let result: MekkoDataPoints = BaseColumnChart.createDataPoints(
                visualHost,
                categorical,
                categories,
                categoryIdentities,
                legend,
                legendAndSeriesInfo.seriesObjects,
                converterStrategy,
                labelSettings,
                is100PercentStacked,
                isScalar,
                supportsOverflow,
                converterHelper.categoryIsAlsoSeriesRole(
                    categorical,
                    RoleNames.series,
                    RoleNames.category),
                firstCategory && firstCategory.objects,
                defaultDataPointColor,
                chartType,
                categoryMetadata);

            if (sortSeriesSettings.enabled) {
                let columns = BaseColumnChart.createAlternateStructure(result, sortSeriesSettings.direction === "des");
                BaseColumnChart.reorderPositions(result, columns);
            }

            const valuesMetadata: DataViewMetadataColumn[] = [];

            for (let j: number = 0; j < legend.length; j++) {
                valuesMetadata.push(seriesSources[j]);
            }

            const labels: axis.utils.AxesLabels = axis.utils.createAxesLabels(
                xAxisCardProperties,
                valueAxisProperties,
                categoryMetadata,
                valuesMetadata);

            return {
                categories,
                categoryFormatter,
                defaultDataPointColor,
                showAllDataPoints,
                categoryMetadata,
                categoriesWidth: result.categoriesWidth,
                borderSettings,
                sortlegend: sortLegendSettings,
                sortSeries: sortSeriesSettings,
                xAxisLabelsSettings: xAxisLabelsSettings,
                labelSettings,
                series: result.series,
                valuesMetadata,
                legendData: legendAndSeriesInfo.legend,
                hasHighlights: result.hasHighlights,
                scalarCategoryAxis: isScalar,
                axesLabels: {
                    x: labels.xAxisLabel,
                    y: labels.yAxisLabel
                },
                hasDynamicSeries: result.hasDynamicSeries,
                categoryProperties: result.categoryProperties,
                isMultiMeasure: false,
                dataPointSettings: dataPointSettings
            };
        }

        private static createAlternateStructure(dataPoint: MekkoDataPoints, descendingDirection: boolean = true): ICategoryValuesCollection[] {
            let series: MekkoChartSeries[] = dataPoint.series;
            let columns: ICategoryValuesCollection[] = [];
            let rowsCount: number = series.length;
            let colsCount: number = d3.max(series.map( s => s.data.length));

            // define all cols 
            series.some((value: MekkoChartSeries, index: number, arr: MekkoChartSeries[]): boolean => {
                if (value.data.length === colsCount) {
                    value.data.forEach(data => {
                        columns[data.categoryIndex] = [];
                    });

                    return true;
                }
                return false;
            });

            for (let col = 0; col < colsCount; col++) {
                for (let row = 0; row < rowsCount; row++) {
                    columns[col] = columns[col] || [];
                    if (series[row].data[col] === undefined) {
                        continue;
                    }
                    if (columns[series[row].data[col].categoryIndex].categoryValue === undefined) {
                        columns[series[row].data[col].categoryIndex].identity = series[row].data[col].identity;
                        columns[series[row].data[col].categoryIndex].categoryValue = series[row].data[col].categoryValue;
                        columns[series[row].data[col].categoryIndex].color = series[row].data[col].color;
                    }

                    columns[series[row].data[col].categoryIndex][row] = series[row].data[col];
                }
            }

            // copy array with specific fields
            for (let col = 0; col < colsCount; col++) {
                let tmpObject = [];
                tmpObject["identity"] = columns[col].identity;
                tmpObject["categoryValue"] = columns[col].categoryValue;
                tmpObject["color"] = columns[col].color;
                columns[col] = _.sortBy(columns[col], BaseColumnChart.ColumSortField);
                if  (descendingDirection) {
                    columns[col] = (columns[col]).reverse();
                }
                columns[col].identity = tmpObject["identity"];
                columns[col].categoryValue = tmpObject["categoryValue"];
                columns[col].color = tmpObject["color"];
            }

            return columns;
        }

        private static reorderPositions(dataPoint: MekkoDataPoints, columns: ICategoryValuesCollection[]) {
            let series: MekkoChartSeries[] = dataPoint.series;
            let colsCount: number = series[0].data.length;
            for (let col = 0; col < colsCount; col++) {
                let columnAbsoluteValue: number = d3.sum(columns[col].map( (val) => {
                    if (val === undefined) {
                        return 0;
                    }
                    return val.valueAbsolute;
                }));
                let absValScale: LinearScale<number, number> = d3.scale.linear().domain([0, columnAbsoluteValue]).range([0, 1]);
                let rowsCount: number = columns[col].length;
                for (let row = 0; row < rowsCount; row++) {
                    if (columns[col][row] === undefined) {
                        continue;
                    }
                    columns[col][row].position = absValScale(columnAbsoluteValue);
                    columnAbsoluteValue -= columns[col][row].valueAbsolute;
                }
            }
        }

        private static getStackedMultiplier(
            rawValues: number[][],
            rowIdx: number,
            seriesCount: number,
            categoryCount: number): ValueMultiplers {

            let pos: number = 0,
                neg: number = 0;

            for (let i: number = 0; i < seriesCount; i++) {
                let value: number = rawValues[i][rowIdx];

                value = AxisHelper.normalizeNonFiniteNumber(value);

                if (value > 0) {
                    pos += value;
                } else if (value < 0) {
                    neg -= value;
                }
            }

            const absTotal: number = pos + neg;

            return {
                pos: BaseColumnChart.getPosition(pos, absTotal),
                neg: BaseColumnChart.getPosition(neg, absTotal)
            };
        }

        private static getStackedMultiplierForAllDataSet(
            rawValues: number[][],
            seriesCount: number,
            categoryCount: number): ValueMultiplers {

            let pos: number = 0,
                neg: number = 0;

            for (let j: number = 0; j < categoryCount; j++) {
                for (let i: number = 0; i < seriesCount; i++) {
                    let value: number = rawValues[i][j];

                    value = AxisHelper.normalizeNonFiniteNumber(value);

                    if (value > 0) {
                        pos += value;
                    } else if (value < 0) {
                        neg -= value;
                    }
                }
            }
            const absTotal: number = pos + neg;

            return {
                pos: BaseColumnChart.getPosition(pos, absTotal),
                neg: BaseColumnChart.getPosition(neg, absTotal)
            };
        }

        private static getPosition(position: number, absTotal: number): number {
            return position
                ? (position / absTotal) / position
                : BaseColumnChart.DefaultStackedPosition;
        }

        private static createDataPoints(
            visualHost: IVisualHost,
            dataViewCat: DataViewCategorical,
            categories: any[],
            categoryIdentities: DataViewScopeIdentity[],
            legend: MekkoLegendDataPoint[],
            seriesObjectsList: IDataViewObjects[][],
            converterStrategy: BaseConverterStrategy,
            defaultLabelSettings: VisualDataLabelsSettings,
            is100PercentStacked: boolean = false,
            isScalar: boolean = false,
            supportsOverflow: boolean = false,
            isCategoryAlsoSeries?: boolean,
            categoryObjectsList?: IDataViewObjects[],
            defaultDataPointColor?: string,
            chartType?: MekkoVisualChartType,
            categoryMetadata?: DataViewMetadataColumn): MekkoDataPoints {

            const grouped: DataViewValueColumnGroup[] = dataViewCat && dataViewCat.values
                ? dataViewCat.values.grouped()
                : undefined;

            const categoryCount = categories.length,
                seriesCount = legend.length,
                columnSeries: MekkoChartSeries[] = [];

            if (seriesCount < 1
                || categoryCount < 1
                || (categories[0] === null && categories[1] === undefined)) {

                return {
                    series: columnSeries,
                    hasHighlights: false,
                    hasDynamicSeries: false,
                    categoriesWidth: [],
                };
            }

            const dvCategories: DataViewCategoryColumn[] = dataViewCat.categories;

            categoryMetadata = (dvCategories && dvCategories.length > 0)
                ? dvCategories[0].source
                : null;

            const categoryType: ValueType = AxisHelper.getCategoryValueType(categoryMetadata),
                isDateTime: boolean = AxisHelper.isDateTime(categoryType),
                baseValuesPos: number[] = [],
                baseValuesNeg: number[] = [],
                rawHighlightValues: number[][] = [],
                hasDynamicSeries = !!(dataViewCat.values && dataViewCat.values.source),
                widthColumns: number[] = [];

            let rawValues: number[][] = [],
                widthIndex: number = -1;

            let highlightsOverflow: boolean = false,
                hasHighlights: boolean = converterStrategy.hasHighlightValues(0);

            for (let seriesIndex: number = 0; seriesIndex < dataViewCat.values.length; seriesIndex++) {
                if (dataViewCat.values[seriesIndex].source.roles
                    && dataViewCat.values[seriesIndex].source.roles[RoleNames.width]
                    && !dataViewCat.values[seriesIndex].source.roles[RoleNames.y]) {

                    widthIndex = seriesIndex;

                    const widthValues: number[] = dataViewCat.values[seriesIndex].values as number[];

                    for (let i: number = 0; i < widthValues.length; i++) {
                        widthColumns[i] = d3.sum([
                            0,
                            widthColumns[i],
                            widthValues[i]
                        ]);
                    }

                    continue;
                }

                const seriesValues: number[] = [],
                    seriesHighlightValues: number[] = [];

                for (let categoryIndex: number = 0; categoryIndex < categoryCount; categoryIndex++) {
                    const value: number = converterStrategy.getValueBySeriesAndCategory(
                        seriesIndex,
                        categoryIndex);

                    seriesValues[categoryIndex] = value;

                    if (hasHighlights) {
                        const highlightValue: number = converterStrategy.getHighlightBySeriesAndCategory(
                            seriesIndex,
                            categoryIndex);

                        seriesHighlightValues[categoryIndex] = highlightValue;

                        // There are two cases where we don't use overflow logic; if all are false, use overflow logic appropriate for the chart.
                        if (!((value >= 0 && highlightValue >= 0 && value >= highlightValue) || // Both positive; value greater than highlight
                            (value <= 0 && highlightValue <= 0 && value <= highlightValue))) { // Both negative; value less than highlight
                            highlightsOverflow = true;
                        }
                    }
                }

                rawValues.push(seriesValues);

                if (hasHighlights) {
                    rawHighlightValues.push(seriesHighlightValues);
                }
            }

            if (highlightsOverflow && !supportsOverflow) {
                highlightsOverflow = false;
                hasHighlights = false;
                rawValues = rawHighlightValues;
            }

            if (widthColumns.length < 1) {
                for (let seriesIndex: number = 0; seriesIndex < dataViewCat.values.length; seriesIndex++) {
                    if (dataViewCat.values[seriesIndex].source.roles
                        && dataViewCat.values[seriesIndex].source.roles[RoleNames.width]) {

                        widthIndex = seriesIndex;

                        const widthValues: number[] = dataViewCat.values[seriesIndex].values as number[];

                        for (let i: number = 0; i < widthValues.length; i++) {
                            widthColumns[i] = d3.sum([
                                0,
                                widthColumns[i],
                                widthValues[i]
                            ]);
                        }

                        continue;
                    }
                }
            }

            if (widthColumns.length < 1) {
                for (let seriesIndex: number = 0; seriesIndex < categoryCount; seriesIndex++) {
                    widthColumns.push(1);
                }
            }

            const totalSum: number = d3.sum(widthColumns),
                linearScale: LinearScale<number, number> = d3.scale.linear()
                    .domain([0, totalSum])
                    .range([0, 1]);

            const columnStartX: number[] = [0],
                columnWidth: number[] = [];

            for (let seriesIndex: number = 0; seriesIndex < (categoryCount - 1); seriesIndex++) {
                const stepWidth: number = columnStartX[columnStartX.length - 1]
                    + (widthColumns[seriesIndex] || 0);

                columnStartX.push(stepWidth);
            }

            for (let seriesIndex: number = 0; seriesIndex < categoryCount; seriesIndex++) {
                columnStartX[seriesIndex] = linearScale(columnStartX[seriesIndex]);
                columnWidth[seriesIndex] = linearScale(widthColumns[seriesIndex]);
            }

            let dataPointObjects: IDataViewObjects[] = categoryObjectsList;
            let multipliersAllData: ValueMultiplers = BaseColumnChart.getStackedMultiplierForAllDataSet(rawValues, seriesCount, categoryCount);

            for (let seriesIndex: number = 0; seriesIndex < seriesCount; seriesIndex++) {
                let seriesDataPoints: MekkoChartColumnDataPoint[] = [],
                    legendItem: MekkoLegendDataPoint = legend[seriesIndex],
                    seriesLabelSettings: VisualDataLabelsSettings;

                if (!hasDynamicSeries) {
                    const labelsSeriesGroup: DataViewValueColumn = grouped
                        && grouped.length > 0
                        && grouped[0].values
                        ? grouped[0].values[seriesIndex]
                        : null;

                    const labelObjects: DataLabelObject = labelsSeriesGroup
                        && labelsSeriesGroup.source
                        && labelsSeriesGroup.source.objects
                        ? labelsSeriesGroup.source.objects["labels"] as DataLabelObject
                        : null;

                    if (labelObjects) {
                        seriesLabelSettings = Prototype.inherit(defaultLabelSettings);

                        dataLabelUtils.updateLabelSettingsFromLabelsObject(
                            labelObjects,
                            seriesLabelSettings);
                    }
                }

                const series: MekkoChartSeries = {
                    displayName: legendItem.label,
                    key: `series${seriesIndex}`,
                    index: seriesIndex,
                    data: seriesDataPoints,
                    identity: legendItem.identity as ISelectionId,
                    color: legendItem.color,
                    labelSettings: seriesLabelSettings,
                };

                if (seriesCount > 1) {
                    dataPointObjects = seriesObjectsList[seriesIndex];
                }

                const metadata: DataViewMetadataColumn = dataViewCat.values[seriesIndex].source;

                for (let categoryIndex: number = 0; categoryIndex < categoryCount; categoryIndex++) {
                    if (seriesIndex === 0) {
                        baseValuesPos.push(0);
                        baseValuesNeg.push(0);
                    }

                    let value: number = AxisHelper.normalizeNonFiniteNumber(
                        rawValues[seriesIndex][categoryIndex]);

                    if (value == null && seriesIndex > 0) {
                        continue;
                    }

                    let originalValue: number = value,
                        categoryValue: any = categories[categoryIndex];

                    if (isDateTime && categoryValue) {
                        categoryValue = categoryValue.getTime();
                    }

                    if (isScalar && (categoryValue == null || isNaN(categoryValue))) {
                        continue;
                    }

                    let multipliers: ValueMultiplers;

                    if (is100PercentStacked) {
                        multipliers = BaseColumnChart.getStackedMultiplier(
                            rawValues,
                            categoryIndex,
                            seriesCount,
                            categoryCount);
                    }

                    let unadjustedValue: number = value,
                        isNegative: boolean = value < 0;

                    if (multipliers) {
                        if (isNegative) {
                            value *= multipliers.neg;
                        } else {
                            value *= multipliers.pos;
                        }
                    }

                    let  valueByAllData = originalValue;
                    if (multipliersAllData) {
                        if (isNegative) {
                            valueByAllData *= multipliersAllData.neg;
                        } else {
                            valueByAllData *= multipliersAllData.pos;
                        }
                    }

                    let valueAbsolute: number = Math.abs(value);
                    let position: number;

                    let valueAbsoluteByAllData: number = Math.abs(valueByAllData);

                    if (isNegative) {
                        position = baseValuesNeg[categoryIndex];

                        if (!isNaN(valueAbsolute)) {
                            baseValuesNeg[categoryIndex] -= valueAbsolute;
                        }
                    }
                    else {
                        if (!isNaN(valueAbsolute)) {
                            baseValuesPos[categoryIndex] += valueAbsolute;
                        }

                        position = baseValuesPos[categoryIndex];
                    }

                    const columnGroup: DataViewValueColumnGroup = grouped
                        && grouped.length > seriesIndex
                        && grouped[seriesIndex].values
                        ? grouped[seriesIndex]
                        : null;

                    const category: DataViewCategoryColumn = dataViewCat.categories
                        && dataViewCat.categories.length > 0
                        ? dataViewCat.categories[0]
                        : null;

                    const identity: ISelectionId = visualHost.createSelectionIdBuilder()
                        .withCategory(category, categoryIndex)
                        .withSeries(dataViewCat.values, columnGroup)
                        .withMeasure(converterStrategy.getMeasureNameByIndex(seriesIndex))
                        .createSelectionId();

                    let color: string = BaseColumnChart.getDataPointColor(
                            legendItem,
                            categoryIndex,
                            dataPointObjects
                    );

                    const seriesData: tooltip.TooltipSeriesDataItem[] = [];

                    if (columnGroup) {
                        const seriesValueColumn: DataViewValueColumn = {
                            values: [],
                            source: dataViewCat.values.source,
                        };

                        seriesData.push({
                            value: columnGroup.name,
                            metadata: seriesValueColumn,
                        });

                        for (let columnIndex: number = 0; columnIndex < columnGroup.values.length; columnIndex++) {
                            const columnValues: DataViewValueColumn = columnGroup.values[columnIndex];

                            seriesData.push({
                                value: columnValues.values[categoryIndex],
                                metadata: columnValues,
                            });
                        }
                    }

                    let rawCategoryValue: any = categories[categoryIndex];
                    let tooltipInfo: VisualTooltipDataItem[] = tooltip.createTooltipInfo(
                        null,
                        rawCategoryValue,
                        originalValue,
                        [category],
                        seriesData,
                        null,
                        categoryIndex);

                    const dataPointLabelSettings: VisualDataLabelsSettings = series && series.labelSettings
                        ? series.labelSettings
                        : defaultLabelSettings;

                    let labelColor: string = dataPointLabelSettings.labelColor,
                        lastValue: boolean = undefined;

                    // Stacked column/bar label color is white by default (except last series)
                    if ((EnumExtensions.hasFlag(chartType, flagStacked))) {
                        lastValue = this.getStackedLabelColor(
                            isNegative,
                            seriesIndex,
                            seriesCount,
                            categoryIndex,
                            rawValues);

                        labelColor = lastValue || (seriesIndex === seriesCount - 1 && !isNegative)
                            ? labelColor
                            : dataLabelUtils.defaultInsideLabelColor;
                    }

                    value = columnWidth[categoryIndex];

                    let originalPosition: number = columnStartX[categoryIndex],
                        dataPoint: MekkoChartColumnDataPoint = {
                            categoryValue,
                            value,
                            position,
                            valueAbsolute,
                            categoryIndex,
                            color,
                            seriesIndex,
                            chartType,
                            identity,
                            tooltipInfo,
                            originalPosition,
                            valueOriginal: unadjustedValue,
                            labelSettings: dataPointLabelSettings,
                            selected: false,
                            originalValue: value,
                            originalValueAbsolute: valueAbsolute,
                            originalValueAbsoluteByAlLData: valueAbsoluteByAllData,
                            key: identity.getKey(),
                            labelFill: labelColor,
                            labelFormatString: metadata.format,
                            lastSeries: lastValue
                        };

                    seriesDataPoints.push(dataPoint);

                    if (hasHighlights) {
                        let valueHighlight: number = rawHighlightValues[seriesIndex][categoryIndex],
                            unadjustedValueHighlight: number = valueHighlight;

                        let highlightedTooltip: boolean = true;

                        if (valueHighlight === null) {
                            valueHighlight = 0;
                            highlightedTooltip = false;
                        }

                        if (is100PercentStacked) {
                            valueHighlight *= multipliers.pos;
                        }

                        let absoluteValueHighlight: number = Math.abs(valueHighlight),
                            highlightPosition: number = position;

                        if (valueHighlight > 0) {
                            highlightPosition -= valueAbsolute - absoluteValueHighlight;
                        }
                        else if (valueHighlight === 0 && value > 0) {
                            highlightPosition -= valueAbsolute;
                        }

                        rawCategoryValue = categories[categoryIndex];

                        let highlightedValue: number = highlightedTooltip
                            ? valueHighlight
                            : undefined;

                        tooltipInfo = tooltip.createTooltipInfo(
                            dataViewCat,
                            rawCategoryValue,
                            originalValue,
                            null,
                            null,
                            seriesIndex,
                            categoryIndex,
                            highlightedValue);

                        if (highlightedTooltip) {
                            dataPoint.tooltipInfo = tooltipInfo;
                        }

                        const highlightDataPoint: MekkoChartColumnDataPoint = {
                            categoryValue,
                            value,
                            seriesIndex,
                            categoryIndex,
                            color,
                            originalPosition,
                            identity,
                            chartType,
                            tooltipInfo,
                            position: highlightPosition,
                            valueAbsolute: absoluteValueHighlight,
                            valueOriginal: unadjustedValueHighlight,
                            labelSettings: dataPointLabelSettings,
                            selected: false,
                            highlight: true,
                            originalValue: value,
                            originalValueAbsolute: valueAbsolute,
                            drawThinner: highlightsOverflow,
                            key: `${identity.getKey()}${BaseColumnChart.HighlightedKeyPostfix}`,
                            labelFormatString: metadata.format,
                            labelFill: labelColor,
                            lastSeries: lastValue
                        };

                        seriesDataPoints.push(highlightDataPoint);
                    }
                }

                columnSeries.push(series);
            }

            let result: MekkoDataPoints = {
                series: columnSeries,
                categoriesWidth: columnWidth,
                hasHighlights: hasHighlights,
                hasDynamicSeries: hasDynamicSeries
            };

            let categoryProperties: MekkoCategoryProperties[] = [];

            result.series.forEach((series) => {
                if (series.data.length !== 1) {
                        return;
                }
                if (categoryProperties[series.data[0].categoryIndex] === undefined) {
                    categoryProperties[series.data[0].categoryIndex] = {
                        valueAbsolute: 0
                    };
                }
                if (series.data[0] !== undefined && series.data[0].valueAbsolute > categoryProperties[series.data[0].categoryIndex].valueAbsolute) {
                    categoryProperties[series.data[0].categoryIndex].valueAbsolute = series.data[0].valueAbsolute;
                    categoryProperties[series.data[0].categoryIndex].color = series.data[0].color;
                    categoryProperties[series.data[0].categoryIndex].name = (series.data[0].categoryValue || "").toString();
                    categoryProperties[series.data[0].categoryIndex].series = series;
                    categoryProperties[series.data[0].categoryIndex].identity = series.identity;
                }
            });
            result.categoryProperties = categoryProperties;

            return result;
        }

        private static getDataPointColor(
            legendItem: MekkoLegendDataPoint,
            categoryIndex: number,
            dataPointObjects?: IDataViewObjects[]): string {

            if (dataPointObjects) {
                let colorOverride: string = DataViewObjects.getFillColor(
                    dataPointObjects[categoryIndex],
                    MekkoChart.Properties["dataPoint"]["fill"]);

                if (colorOverride) {
                    return colorOverride;
                }
            }

            return legendItem.color;
        }

        private static getStackedLabelColor(
            isNegative: boolean,
            seriesIndex: number,
            seriesCount: number,
            categoryIndex: number,
            rawValues: number[][]): boolean {

            let lastValue: boolean = !(isNegative
                && seriesIndex === seriesCount - 1
                && seriesCount !== 1);

            // run for the next series and check if current series is last
            for (let i: number = seriesIndex + 1; i < seriesCount; i++) {
                const nextValues: number = AxisHelper.normalizeNonFiniteNumber(rawValues[i][categoryIndex]);

                if ((nextValues !== null)
                    && (((!isNegative || (isNegative && seriesIndex === 0)) && nextValues > 0)
                        || (isNegative && seriesIndex !== 0))) {

                    lastValue = false;
                    break;
                }
            }

            return lastValue;
        }

        public static sliceSeries(
            series: MekkoChartSeries[],
            endIndex: number,
            startIndex: number = 0): MekkoChartSeries[] {

            const newSeries: MekkoChartSeries[] = [];

            if (series && series.length > 0) {
                for (let i: number = 0, len = series.length; i < len; i++) {
                    const iNewSeries: MekkoChartSeries = newSeries[i] = Prototype.inherit(series[i]);

                    iNewSeries.data = series[i].data.filter((dataPoint: MekkoChartColumnDataPoint) => {
                        return dataPoint.categoryIndex >= startIndex
                            && dataPoint.categoryIndex < endIndex;
                    });
                }
            }

            return newSeries;
        }

        public getColumnsWidth(): number[] {
            const data: MekkoColumnChartData = this.data;

            if (!data
                || !data.series
                || !data.series[0]
                || !data.series[0].data) {

                return [];
            }

            return data.categoriesWidth;
        }

        public getBorderWidth(): number {
            return BaseColumnChart.getBorderWidth(this.data.borderSettings);
        }

        public getSeriesSortSettings(): MekkoSeriesSortSettings {
            return this.data.sortSeries;
        }

        public getLegendSortSettings(): MekkoLegendSortSettings {
            return this.data.sortlegend;
        }

        public getXAxisLabelsSettings(): MekkoXAxisLabelsSettings {
            return this.data.xAxisLabelsSettings;
        }

        public setData(dataViews: DataView[]): void {
            this.data = {
                categories: [],
                categoriesWidth: [],
                categoryFormatter: null,
                series: [],
                valuesMetadata: [],
                legendData: null,
                hasHighlights: false,
                categoryMetadata: null,
                scalarCategoryAxis: false,
                borderSettings: null,
                sortlegend: null,
                sortSeries: null,
                xAxisLabelsSettings: null,
                labelSettings: dataLabelUtils.getDefaultColumnLabelSettings(true),
                axesLabels: { x: null, y: null },
                hasDynamicSeries: false,
                defaultDataPointColor: null,
                isMultiMeasure: false,
                categoryProperties: null,
                dataPointSettings: null
            };

            if (dataViews.length > 0) {
                const dataView: DataView = dataViews[0];

                if (dataView && dataView.categorical) {
                    this.dataViewCat = dataView.categorical;
                    this.data = BaseColumnChart.converter(
                        this.visualHost,
                        this.dataViewCat,
                        this.cartesianVisualHost.getSharedColors(),
                        true,
                        false,
                        this.supportsOverflow,
                        dataView.metadata,
                        this.chartType);

                    for (let currentSeries of this.data.series) {
                        if (this.interactivityService) {
                            this.interactivityService.applySelectionStateToData(currentSeries.data);
                        }
                    }
                }
            }
        }

        public calculateLegend(): ILegendData {
            const legendData: ILegendData = this.data
                ? this.data.legendData
                : null;

            const dataPoints: LegendDataPoint[] = legendData
                ? legendData.dataPoints
                : [];

            if (ArrayExtensions.isUndefinedOrEmpty(dataPoints)) {
                return null;
            }

            return legendData;
        }

        public hasLegend(): boolean {
            return this.data
                && (this.data.hasDynamicSeries
                    || (this.data.series && this.data.series.length > 1));
        }

        public enumerateObjectInstances(
            enumeration: VisualObjectInstance[],
            options: EnumerateVisualObjectInstancesOptions): void {

            switch (options.objectName) {
                case "dataPoint": {
                    this.enumerateDataPoints(enumeration);
                    break;
                }
                case "labels": {
                    this.enumerateDataLabels(enumeration);
                    break;
                }
                case "xAxisLabels": {
                    this.enumerateXAxisLabels(enumeration);
                    break;
                }
                case "sortLegend": {
                    this.enumerateSortLegend(enumeration);
                    break;
                }
                case "categoryColorStart": {
                    this.enumerateCategoryColors(enumeration, "categoryColorStart", "Start color");
                    break;
                }
                case "categoryColorEnd": {
                    this.enumerateCategoryColors(enumeration, "categoryColorEnd", "End color");
                    break;
                }
            }
        }

        private enumerateCategoryColors(instances: VisualObjectInstance[], objectName: string, label: string) {
            if (this.data.dataPointSettings && this.data.dataPointSettings.categoryGradient) {
                this.data.categories.forEach( (category, index ) => {
                    let categoryLegends: MekkoLegendDataPoint[] = this.data.legendData.dataPoints.filter( legend => legend.category === category);

                    instances.push({
                        objectName: objectName,
                        displayName: `${label} -${category}`,
                        selector: ColorHelper.normalizeSelector((categoryLegends[0].categoryIdentity as ISelectionId).getSelector(), true),
                        properties: {
                            categoryGradient: {
                                solid: {
                                    color: objectName === "categoryColorStart" ? categoryLegends[0].categoryStartColor : categoryLegends[0].categoryEndColor
                                }
                            }
                        },
                    });
                });
            }
        }

        private enumerateXAxisLabels(instances: VisualObjectInstance[]): void {
            instances[0] = <VisualObjectInstance>{
                objectName: "xAxisLabels",
                properties: {}
            };
            instances[0].properties["enableRotataion"] = this.data.xAxisLabelsSettings.enableRotataion;
        }

        private enumerateSortLegend(instances: VisualObjectInstance[]): void {
            instances[0] = <VisualObjectInstance>{
                objectName: "sortLegend",
                properties: {}
            };
            instances[0].properties["enabled"] = this.data.sortlegend.enabled;
            instances[0].properties["direction"] = this.data.sortlegend.direction;

            instances[0].properties["groupByCategory"] = this.data.sortlegend.groupByCategory;
            instances[0].properties["groupByCategoryDirection"] = this.data.sortlegend.groupByCategoryDirection;
        }

        private enumerateSortSeries(instances: VisualObjectInstance[]): void {
            instances[0] = <VisualObjectInstance>{
                objectName: "sortSeries",
                properties: {}
            };
            instances[0].properties["enabled"] = this.data.sortSeries.enabled;
            instances[0].properties["direction"] = this.data.sortSeries.direction;
            instances[0].properties["displayPercents"] = this.data.sortSeries.displayPercents;
        }

        private enumerateDataLabels(instances: VisualObjectInstance[]): void {
            const data: MekkoColumnChartData = this.data,
                seriesCount: number = data.series.length;

            // Draw default settings
            dataLabelUtils.enumerateDataLabels(this.getLabelSettingsOptions(
                instances,
                this.data.labelSettings,
                false));

            (<any>instances[0].properties).forceDisplay = (<MekkoChartLabelSettings>this.data.labelSettings).forceDisplay;

            if (seriesCount === 0) {
                return;
            }

            if (!data.hasDynamicSeries && (seriesCount > 1 || !data.categoryMetadata)) {
                for (let i: number = 0; i < seriesCount; i++) {
                    const series: MekkoChartSeries = data.series[i],
                        labelSettings: VisualDataLabelsSettings = (series.labelSettings)
                            ? series.labelSettings
                            : this.data.labelSettings;

                    dataLabelUtils.enumerateDataLabels(
                        this.getLabelSettingsOptions(
                            instances,
                            labelSettings,
                            true,
                            series));
                }
            }
        }

        private getLabelSettingsOptions(
            instances: VisualObjectInstance[],
            labelSettings: VisualDataLabelsSettings,
            isSeries: boolean,
            series?: MekkoChartSeries): MekkoChartLabelSettingsOptions {

            return {
                instances: instances,
                dataLabelsSettings: labelSettings,
                show: !isSeries,
                displayUnits: true,
                precision: true,
                forceDisplay: true,
                fontSize: false,
                selector: series && series.identity
                    ? series.identity.getSelector()
                    : null
            };
        }

        public getData() {
            return this.data;
        }

        private checkDataToFeatures(): boolean {
            return !this.data.legendData.dataPoints.some( (value: MekkoLegendDataPoint) => {
                return value.categoryValues.filter( value => value).length > 1;
            });
        }

        private enumerateDataPoints(instances: VisualObjectInstance[]): void {
            const data: MekkoColumnChartData = this.data;

            if (!data || !data.series) {
                return;
            }

            const seriesCount: number = data.series.length;

            if (seriesCount === 0) {
                return;
            }

            let properties: any = {};
            properties["categoryGradient"] = this.data.dataPointSettings.categoryGradient;

            instances.push({
                objectName: "dataPoint",
                selector: null,
                properties: properties
            });

            if (data.hasDynamicSeries || seriesCount > 1 || !data.categoryMetadata) {
                if (!this.data.dataPointSettings.categoryGradient) {
                    for (let series of data.series) {
                        instances.push({
                            objectName: "dataPoint",
                            displayName: series.displayName,
                            selector: ColorHelper.normalizeSelector(series.identity.getSelector()),
                            properties: {
                                fill: { solid: { color: series.color } }
                            },
                        });
                    }
                }
            }
            else {
                // For single-category, single-measure column charts, the user can color the individual bars.
                const singleSeriesData: MekkoChartColumnDataPoint[] = data.series[0].data,
                    categoryFormatter: IValueFormatter = data.categoryFormatter;

                // Add default color and show all slices
                instances.push({
                    objectName: "dataPoint",
                    selector: null,
                    properties: {
                        defaultColor: {
                            solid: {
                                color: data.defaultDataPointColor || this.colorPalette.getColor("0").value
                            }
                        }
                    }
                });

                instances.push({
                    objectName: "dataPoint",
                    selector: null,
                    properties: {
                        showAllDataPoints: !!data.showAllDataPoints
                    }
                });

                for (let i: number = 0; i < singleSeriesData.length && data.showAllDataPoints; i++) {
                    const singleSeriesDataPoints = singleSeriesData[i],
                        categoryValue: any = data.categories[i];

                    instances.push({
                        objectName: "dataPoint",
                        displayName: categoryFormatter
                            ? categoryFormatter.format(categoryValue)
                            : categoryValue,
                        selector: ColorHelper.normalizeSelector(
                            (singleSeriesDataPoints.identity as ISelectionId).getSelector(),
                            true),
                        properties: {
                            fill: { solid: { color: singleSeriesDataPoints.color } }
                        },
                    });
                }
            }
        }

        public calculateAxesProperties(options: MekkoCalculateScaleAndDomainOptions): IAxisProperties[] {
            const data: MekkoColumnChartData = this.data;

            this.currentViewport = options.viewport;
            this.margin = options.margin;

            const origCategorySize: number = data && data.categories
                ? data.categories.length
                : 0;

            const chartLayout: MekkoChartCategoryLayout = data
                ? this.getCategoryLayout(origCategorySize, options)
                : {
                    categoryCount: 0,
                    categoryThickness: MekkoChart.MinOrdinalRectThickness,
                    outerPaddingRatio: MekkoChart.OuterPaddingRatio,
                    isScalar: false
                };

            this.categoryAxisType = chartLayout.isScalar
                ? axis.type.scalar
                : null;

            this.columnChart.setData(data);

            const preferredPlotArea: IViewport = this.getPreferredPlotArea(
                chartLayout.isScalar,
                chartLayout.categoryCount,
                chartLayout.categoryThickness);

            /**
             * preferredPlotArea would be same as currentViewport width when there is no scrollbar.
             * In that case we want to calculate the available plot area for the shapes by subtracting the margin from available viewport
             */
            if (preferredPlotArea.width === this.currentViewport.width) {
                preferredPlotArea.width -= (this.margin.left + this.margin.right);
            }

            preferredPlotArea.height -= (this.margin.top + this.margin.bottom);

            // When the category axis is scrollable the height of the category axis and value axis will be different
            // The height of the value axis would be same as viewportHeight
            const chartContext: MekkoColumnChartContext = {
                height: preferredPlotArea.height,
                width: preferredPlotArea.width,
                duration: 0,
                hostService: this.visualHost,
                unclippedGraphicsContext: this.unclippedGraphicsContext,
                mainGraphicsContext: this.mainGraphicsContext,
                labelGraphicsContext: this.labelGraphicsContext,
                margin: this.margin,
                layout: chartLayout,
                interactivityService: this.interactivityService,
                viewportHeight: this.currentViewport.height - (this.margin.top + this.margin.bottom),
                viewportWidth: this.currentViewport.width - (this.margin.left + this.margin.right),
                is100Pct: BaseColumnChart.Is100Pct,
                isComboChart: true,
            };

            this.columnChart.setupVisualProps(chartContext);

            const isBarChart: boolean = EnumExtensions.hasFlag(this.chartType, flagBar);

            if (isBarChart) {
                [options.forcedXDomain, options.forcedYDomain] = [options.forcedYDomain, options.forcedXDomain];
            }

            this.xAxisProperties = this.columnChart.setXScale(
                BaseColumnChart.Is100Pct,
                options.forcedTickCount,
                options.forcedXDomain,
                isBarChart
                    ? options.valueAxisScaleType
                    : options.categoryAxisScaleType);

            this.yAxisProperties = this.columnChart.setYScale(
                BaseColumnChart.Is100Pct,
                options.forcedTickCount,
                options.forcedYDomain,
                isBarChart
                    ? options.categoryAxisScaleType
                    : options.valueAxisScaleType);

            if (options.showCategoryAxisLabel
                && this.xAxisProperties.isCategoryAxis
                || options.showValueAxisLabel
                && !this.xAxisProperties.isCategoryAxis) {

                this.xAxisProperties.axisLabel = data.axesLabels.x;
            }
            else {
                this.xAxisProperties.axisLabel = null;
            }
            if (options.showValueAxisLabel
                && !this.yAxisProperties.isCategoryAxis
                || options.showCategoryAxisLabel
                && this.yAxisProperties.isCategoryAxis) {

                this.yAxisProperties.axisLabel = data.axesLabels.y;
            }
            else {
                this.yAxisProperties.axisLabel = null;
            }

            return [
                this.xAxisProperties,
                this.yAxisProperties
            ];
        }

        public getPreferredPlotArea(
            isScalar: boolean,
            categoryCount: number,
            categoryThickness: number): IViewport {

            const viewport: IViewport = {
                height: this.currentViewport.height,
                width: this.currentViewport.width
            };

            if (this.isScrollable && !isScalar) {
                const preferredWidth: number = MekkoChart.getPreferredCategorySpan(
                    categoryCount,
                    categoryThickness);

                if (EnumExtensions.hasFlag(this.chartType, flagBar)) {
                    viewport.height = Math.max(preferredWidth, viewport.height);
                }
                else {
                    viewport.width = Math.max(preferredWidth, viewport.width);
                }
            }

            return viewport;
        }

        private selectColumn(indexOfColumnSelected: number, force: boolean = false): void {
            if (!force && this.lastInteractiveSelectedColumnIndex === indexOfColumnSelected) { // same column, nothing to do here
                return;
            }

            const legendData: ILegendData = this.createInteractiveMekkoLegendDataPoints(indexOfColumnSelected),
                MekkoLegendDataPoints: MekkoLegendDataPoint[] = legendData.dataPoints;

            this.cartesianVisualHost.updateLegend(legendData);

            if (MekkoLegendDataPoints.length > 0) {
                this.columnChart.selectColumn(
                    indexOfColumnSelected,
                    this.lastInteractiveSelectedColumnIndex);
            }

            this.lastInteractiveSelectedColumnIndex = indexOfColumnSelected;
        }

        private createInteractiveMekkoLegendDataPoints(columnIndex: number): ILegendData {
            const data: MekkoColumnChartData = this.data;

            if (!data || ArrayExtensions.isUndefinedOrEmpty(data.series)) {
                return { dataPoints: [] };
            }

            const legendDataPoints: MekkoLegendDataPoint[] = [],
                category: any = data.categories && data.categories[columnIndex],
                allSeries: MekkoChartSeries[] = data.series,
                dataPoints: LegendDataPoint[] = data.legendData && data.legendData.dataPoints,
                converterStrategy: BaseConverterStrategy =
                    new BaseConverterStrategy(this.dataViewCat, this.visualHost);

            for (let i: number = 0, len = allSeries.length; i < len; i++) {
                let measure: number = converterStrategy.getValueBySeriesAndCategory(i, columnIndex),
                    valueMetadata: DataViewMetadataColumn = data.valuesMetadata[i],
                    formattedLabel: string = getFormattedLegendLabel(valueMetadata, this.dataViewCat.values),
                    dataPointColor: string;

                if (allSeries.length === 1) {
                    const series: MekkoChartSeries = allSeries[0];

                    dataPointColor = series.data.length > columnIndex && series.data[columnIndex].color;
                } else {
                    dataPointColor = dataPoints.length > i && dataPoints[i].color;
                }

                const emptyIdentity: ISelectionId = this.visualHost
                    .createSelectionIdBuilder()
                    .createSelectionId();

                legendDataPoints.push({
                    color: dataPointColor,
                    icon: LegendIcon.Box,
                    label: formattedLabel,
                    category: data.categoryFormatter
                        ? data.categoryFormatter.format(category)
                        : category,
                    measure: valueFormatter.format(
                        measure,
                        valueFormatter.getFormatStringByColumn(valueMetadata)),
                    identity: emptyIdentity,
                    selected: false
                });
            }

            return { dataPoints: legendDataPoints };
        }

        public overrideXScale(xProperties: IAxisProperties): void {
            this.xAxisProperties = xProperties;
        }

        public render(suppressAnimations: boolean): MekkoVisualRenderResult {
            const chartDrawInfo: MekkoChartDrawInfo = this.columnChart.drawColumns(!suppressAnimations),
                data: MekkoColumnChartData = this.data;

            const margin: IMargin = this.margin,
                viewport: IViewport = this.currentViewport,
                height: number = viewport.height - (margin.top + margin.bottom),
                width: number = viewport.width - (margin.left + margin.right);

            this.mainGraphicsContext.attr({
                height: height,
                width: width
            });

            this.tooltipServiceWrapper.addTooltip<TooltipEnabledDataPoint>(
                chartDrawInfo.shapesSelection,
                (tooltipEvent: TooltipEventArgs<TooltipEnabledDataPoint>) => {
                    return tooltipEvent.data.tooltipInfo;
                });

            let dataPoints: MekkoChartColumnDataPoint[] = [],
                behaviorOptions: VisualBehaviorOptions = undefined;

            if (this.interactivityService) {
                for (let dataPointIndex: number = 0; dataPointIndex < data.series.length; dataPointIndex++) {
                    dataPoints = dataPoints.concat(data.series[dataPointIndex].data);
                }

                behaviorOptions = {
                    dataPoints,
                    bars: chartDrawInfo.shapesSelection,
                    hasHighlights: data.hasHighlights,
                    eventGroup: this.mainGraphicsContext,
                    mainGraphicsContext: this.mainGraphicsContext,
                    viewport: chartDrawInfo.viewport,
                    axisOptions: chartDrawInfo.axisOptions,
                    showLabel: data.labelSettings.show
                };
            }

            return {
                dataPoints,
                behaviorOptions,
                labelDataPoints: chartDrawInfo.labelDataPoints,
                labelsAreNumeric: true
            };
        }

        public onClearSelection(): void {
            if (this.interactivityService) {
                this.interactivityService.clearSelection();
            }
        }

        public getVisualCategoryAxisIsScalar(): boolean {
            return this.data
                ? this.data.scalarCategoryAxis
                : false;
        }

        public getSupportedCategoryAxisType(): string {
            const metaDataColumn: DataViewMetadataColumn = this.data
                ? this.data.categoryMetadata
                : undefined;

            const valueType: ValueType = AxisHelper.getCategoryValueType(metaDataColumn),
                isOrdinal: boolean = AxisHelper.isOrdinal(valueType);

            return isOrdinal
                ? axis.type.categorical
                : axis.type.both;
        }

        public setFilteredData(startIndex: number, endIndex: number): MekkoChartBaseData {
            const data: MekkoColumnChartData = Prototype.inherit(this.data);

            data.series = BaseColumnChart.sliceSeries(data.series, endIndex, startIndex);
            data.categories = data.categories.slice(startIndex, endIndex);
            this.columnChart.setData(data);

            return data;
        }
    }

    export function createBaseColumnChartLayer(
        type: MekkoVisualChartType,
        defaultOptions: MekkoChartConstructorBaseOptions): BaseColumnChart {

        const options: MekkoChartConstructorOptions = {
            interactivityService: defaultOptions.interactivityService,
            isScrollable: defaultOptions.isScrollable,
            chartType: type
        };

        return new BaseColumnChart(options);
    }
}