sap.ui.define([
    "sap/ui/core/mvc/Controller",
	"sap/ui/core/Fragment",
	"sap/ui/model/odata/v2/ODataModel",
	"sap/ui/core/syncStyleClass"
],
function (Controller, Fragment, ODataModel, syncStyleClass) {
    "use strict";
	
    let oModelCab = new sap.ui.model.json.JSONModel({});

    return Controller.extend("zewmpickingtflt.controller.MainDetail", {
        onInit: function () {

			this.sShrinkRatio = "1:1.6:1.6";

			let oRouter = this.getOwnerComponent().getRouter();
			oRouter.getRoute("RouteMainDetail").attachPatternMatched(this._onObjectMatched,this);
		},
		
		_onObjectMatched:async function(oEvent){
			
			//arguments recebe as propriedades passadas pelo hsash da URL
			let oArgs = oEvent.getParameter("arguments");
			
			let sTransporte = oArgs.Transporte;
			let sStatus = oArgs.Status;
					
			//--------------------------------------------------
			// Binding
			//--------------------------------------------------
			let spath = `/(Transporte='` + sTransporte + `')`;
			let oView =  this.getView();
			
			oView.bindElement({
					path: spath,
					expand: 'RouteMainDetail'
			});

			//--------------------------------------------------
			// Criar Model local Cabeçalho
			//--------------------------------------------------
			
			oModelCab.oData.transporte = sTransporte;
			oModelCab.oData.status  = sStatus;

			oModelCab.oData.qtdeItens = 0;
			
			oModelCab.setData(oModelCab.oData);
			this.getView().setModel(oModelCab, 'modelCab');

			//--------------------------------------------------
			//Aplicar Filtro no Table com dados do cabeçalho
			//--------------------------------------------------
			let oTable = this.byId("idTable");
			let oTransporte = new sap.ui.model.Filter("Transporte", sap.ui.model.FilterOperator.Contains, sTransporte);
			let oStatus = new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.Contains, sStatus);
			let allFilter = new sap.ui.model.Filter([oTransporte, oStatus], false); 
			let oBinding = oTable.getBinding("items");
			oBinding.filter(allFilter);

			// refresh no grid
			let oViewModel = this.getView().getModel().refresh();

		},
		getPage : function() {
			return this.byId("dynamicPageId");
		},
		onToggleFooter: function () {
			this.getPage().setShowFooter(!this.getPage().getShowFooter());
		},
		toggleAreaPriority: function () {
			let oTitle = this.getPage().getTitle(),
				sDefaultShrinkRatio = oTitle.getMetadata().getProperty("areaShrinkRatio").getDefaultValue(),
				sNewShrinkRatio = oTitle.getAreaShrinkRatio() === sDefaultShrinkRatio ? "1.6:1:1.6" : sDefaultShrinkRatio;
			oTitle.setAreaShrinkRatio(sNewShrinkRatio);
		},

		// Ao finalizar o UPDATE do Table
		onUpdateFinished: function(){
			
			oModelCab.oData.qtdeItens = this.getView().byId("idTable").getItems().length;
            oModelCab.setData(oModelCab.oData);
		},

		onLoteSHPress: function(){
			
		},

		LiveChangeOvNova: function(){		

			oModelCab.oData.ovNova = this.byId("idNovaOv").getValue().trim();
            this.inserirPicking();
		},
        
		inserirPicking: function () {

			//--------------------------------------------------
			// Inserir Picking na tab. itens do SAP
			//--------------------------------------------------
			// ler Model locais auxiliares
			// let oModelCab 		= this.getView().getModel('modelCab');
			// let oModelLoteNovo 	= this.getView().getModel('modelLoteNovo');

			// Preencher dados p/ o novo item de picking
			var dados = {
				Transporte: 	 oModelCab.oData.transporte,
				Ov: 		     oModelCab.oData.ovNova,
				Status: 		 '2'  //Em Picking
			};
			
			// Picking SAP Model
			let oModel = new ODataModel("/sap/opu/odata/sap/ZGWEWM_PICKING_TF_SRV");
			
			// Inserir novo item de Picking
			// Salvar novo lote lido nas tabelas ZEWMT0011S4 e ZEWMT0012S4.
			// Adiciona lote lido na lista de picking (Refresh na model do Grid).
			oModel.create("/PickingSet", dados, {
				success: function (oDados, response) {
					
					// Limpar campo de input de Lote novo
					this.getView().byId("idNovaOv").setValue("");
					// refresh no grid
					this.getView().getModel().refresh();

					// //Atualizar STATUS na tela
					// this.atualizarStatusTela('Em Picking', oModelCab);

				}.bind(this),
				error: function (oError) {
					// Limpar campo de input de Lote novo
					this.getView().byId("idNovaOv").setValue("");
					
					let oMessage = JSON.parse(oError.responseText);
                    let oMessage2 = (oMessage.error.innererror.errordetails[0].message);
					sap.m.MessageBox.error("Erro técnico ao inserir novo  picking");
				}.bind(this),
			});
		}

    });
});