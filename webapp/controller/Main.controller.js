sap.ui.define([
    "sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	'sap/ui/model/Filter',
	'sap/ui/model/FilterOperator',
	'sap/ui/comp/smartvariants/PersonalizableInfo'
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, JSONModel, Filter, FilterOperator, PersonalizableInfo) {
        "use strict";

        return Controller.extend("fiorifreestylepicking01.controller.Main", {
            onInit: function () {

                //Dynamic Page
                this.sShrinkRatio = "1:1.6:1.6";
    
                //Filter
    
                this.oSmartVariantManagement = this.getView().byId("svm");
                this.oExpandedLabel = this.getView().byId("expandedLabel");
                this.oSnappedLabel = this.getView().byId("snappedLabel");
                this.oFilterBar = this.getView().byId("filterbar");
                this.oTable = this.getView().byId("idTable");
    
                this.oFilterBar.registerFetchData(this.fetchData);
                this.oFilterBar.registerApplyData(this.applyData);
                this.oFilterBar.registerGetFiltersWithValues(this.getFiltersWithValues);
    
                var oPersInfo = new PersonalizableInfo({
                    type: "filterBar",
                    keyName: "persistencyKey",
                    dataSource: "",
                    control: this.oFilterBar
                });
                this.oSmartVariantManagement.addPersonalizableControl(oPersInfo);
                this.oSmartVariantManagement.initialise(function () {}, this.oFilterBar);
    
            },
    
            //----------------------------------
            //Filter 
            //----------------------------------
            onExit: function() {
                this.oModel = null;
                this.oSmartVariantManagement = null;
                this.oExpandedLabel = null;
                this.oSnappedLabel = null;
                this.oFilterBar = null;
                this.oTable = null;
            },
    
            fetchData: function () {
                var aData = this.oFilterBar.getAllFilterItems().reduce(function (aResult, oFilterItem) {
                    aResult.push({
                        groupName: oFilterItem.getGroupName(),
                        fieldName: oFilterItem.getName(),
                        fieldData: oFilterItem.getControl().getSelectedKeys()
                    });
    
                    return aResult;
                }, []);
    
                return aData;
            },
    
            applyData: function (aData) {
                aData.forEach(function (oDataObject) {
                    var oControl = this.oFilterBar.determineControlByName(oDataObject.fieldName, oDataObject.groupName);
                    oControl.setSelectedKeys(oDataObject.fieldData);
                }, this);
            },
    
            onSelectionChange: function (oEvent) {
                this.oSmartVariantManagement.currentVariantSetModified(true);
                this.oFilterBar.fireFilterChange(oEvent);
            },
    
            onSearch: function () {
                let aTableFilters = this.oFilterBar.getFilterGroupItems().reduce(function (aResult, oFilterGroupItem) {
    
                    let aSelectedKeys = [],
                        aFilters = [],
                        oControl = oFilterGroupItem.getControl();
    
                    if (oControl.getName() === 'Transporte' || 
                        oControl.getName() === 'Status') 
                    {
                        
                            aSelectedKeys = oControl.getSelectedKeys();
                            
                            if (oControl.getName() === 'CampoX') {
                                aFilters = aSelectedKeys.map(function (sSelectedKey) {
                                    return new Filter({
                                        path: oFilterGroupItem.getName(),
                                        operator: FilterOperator.EQ,
                                        value1: sSelectedKey
                                    });
                                });
                            } else {
                                aFilters = aSelectedKeys.map(function (sSelectedKey) {
                                    return new Filter({
                                        path: oFilterGroupItem.getName(),
                                        operator: FilterOperator.Contains,
                                        value1: sSelectedKey
                                    });
                                });
                            }
                    }
    
                    if (aSelectedKeys.length > 0) {
                        aResult.push(new Filter({
                            filters: aFilters,
                            and: false
                        }));
                    }
    
                    return aResult;
                }, []);
    
                this.oTable.getBinding("items").filter(aTableFilters);
                this.oTable.setShowOverlay(false);
            },
    
            onFilterChange: function () {
                this._updateLabelsAndTable();
            },
    
            onAfterVariantLoad: function () {
                this._updateLabelsAndTable();
            },
    
            getFormattedSummaryText: function() {
                var aFiltersWithValues = this.oFilterBar.retrieveFiltersWithValues();
    
                if (aFiltersWithValues.length === 0) {
                    return "No filters active";
                }
    
                if (aFiltersWithValues.length === 1) {
                    return aFiltersWithValues.length + " filter active: " + aFiltersWithValues.join(", ");
                }
    
                return aFiltersWithValues.length + " filters active: " + aFiltersWithValues.join(", ");
            },
    
            getFormattedSummaryTextExpanded: function() {
                var aFiltersWithValues = this.oFilterBar.retrieveFiltersWithValues();
    
                if (aFiltersWithValues.length === 0) {
                    return "No filters active";
                }
    
                var sText = aFiltersWithValues.length + " filters active",
                    aNonVisibleFiltersWithValues = this.oFilterBar.retrieveNonVisibleFiltersWithValues();
    
                if (aFiltersWithValues.length === 1) {
                    sText = aFiltersWithValues.length + " filter active";
                }
    
                if (aNonVisibleFiltersWithValues && aNonVisibleFiltersWithValues.length > 0) {
                    sText += " (" + aNonVisibleFiltersWithValues.length + " hidden)";
                }
    
                return sText;
            },
    
            _updateLabelsAndTable: function () {
                this.oExpandedLabel.setText(this.getFormattedSummaryTextExpanded());
                this.oSnappedLabel.setText(this.getFormattedSummaryText());
                this.oTable.setShowOverlay(true);
            },
            //----------------------------------
            //Dynamic Page
            //----------------------------------
            getPage : function() {
                return this.byId("dynamicPageId");
            },
            onToggleFooter: function () {
                this.getPage().setShowFooter(!this.getPage().getShowFooter());
            },
            toggleAreaPriority: function () {
                var oTitle = this.getPage().getTitle(),
                    sDefaultShrinkRatio = oTitle.getMetadata().getProperty("areaShrinkRatio").getDefaultValue(),
                    sNewShrinkRatio = oTitle.getAreaShrinkRatio() === sDefaultShrinkRatio ? "1.6:1:1.6" : sDefaultShrinkRatio;
                oTitle.setAreaShrinkRatio(sNewShrinkRatio);
            },
            onPressOpenPopover: function (oEvent) {
                var oView = this.getView(),
                    oSourceControl = oEvent.getSource();
    
                if (!this._pPopover) {
                    this._pPopover = Fragment.load({
                        id: oView.getId(),
                        name: "sap.f.sample.DynamicPageFreeStyle.view.Card"
                    }).then(function (oPopover) {
                        oView.addDependent(oPopover);
                        return oPopover;
                    });
                }
    
                this._pPopover.then(function (oPopover) {
                    oPopover.openBy(oSourceControl);
                });
            },
            onLinePress: function (oEvent) {
    
                let oRouter = sap.ui.core.UIComponent.getRouterFor(this);

                try {
                    let oItem, oCtx;
                    oItem = oEvent.getSource();
                    oCtx = oItem.getBindingContext();
                    

                    //aqui é quando já há lotes no picking
                    oRouter.navTo("RouteMainDetail",{
                        Transporte : oCtx.getProperty("Transporte"),
                        Status : oCtx.getProperty("Status") ? oCtx.getProperty("Status") : '1'
                    });
                
                } catch (error) {
                    //se nao conseguir pegar o transporte no oEvent,
                    //procurar na linha que o usuário clicou
                    let aIndexClicado = oEvent.mParameters.id.match(/\d+$/g);
                    let nIndexClicado = aIndexClicado[0];
    
                    let loopIndex = 0;
                    this.getView().byId("idTable").getItems().forEach(function(element) {
                        if (parseInt(loopIndex) == parseInt(nIndexClicado)) {
                            let aTransporte = element.getBindingContext().sPath.match(/'\d+'/g);
                            let sTransporte = aTransporte[0];
                            oRouter.navTo("RouteMainDetail",{
                                Transporte : sTransporte,
                                Status : '1'
                            });
                        }
                        loopIndex++;
                    });
                }
            }
        });
    });
