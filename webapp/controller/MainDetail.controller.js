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
			
			//--------------------------------------------------
			// Criar Model local Lote Novo
			//--------------------------------------------------
			let oModelLoteNovo = new sap.ui.model.json.JSONModel({});
			oModelLoteNovo.setData(oModelLoteNovo.oData);
			this.getView().setModel(oModelLoteNovo, 'modelLoteNovo');

            //--------------------------------------------------
			// Criar Model Lote a ser eliminado
			//--------------------------------------------------
			let oModelLoteAEliminar = new sap.ui.model.json.JSONModel({});
			oModelLoteAEliminar.setData(oModelLoteAEliminar.oData);
			this.getView().setModel(oModelLoteAEliminar, 'modelLoteAEliminar');

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
			
			// Atualizar Quantidade de Bobinas
			let oModelCab = this.getView().getModel('modelCab');
			oModelCab.oData.quantidadeBoninas = this.getView().byId("idPickingTransfTable").getItems().length;
			oModelCab.setData(oModelCab.oData);
			
			//Atualizar STATUS na tela
			if (oModelCab.oData.quantidadeBoninas === 0) {
				this.atualizarStatusTela('Inicial', oModelCab);				
			} 
			// else {
			// 	this.atualizarStatusTela('Em Picking', oModelCab);
			// }

		},

		onLoteSHPress: function(){
			
		},

		onLiveChangeCabLoteNovo: function(){		

			//--------------------------------------------------
			// Linserir Lote novo na lista de picking
			//--------------------------------------------------

			// Model locais auxiliares
			let oModelCab = this.getView().getModel('modelCab');
			let oModelLoteNovo = this.getView().getModel('modelLoteNovo');
			
			// Validar antes se pode
			if (!this.validarAcaoOk('InserirLote',oModelCab)) {
				// Erro não pode inserir mais lotes
				sap.m.MessageBox.error('Erro. Só pode inserir lote quando status for Inicial ou Em Picking');
				return;
			}


			let lv_loteInseridoTela = this.byId("_IDGenLoteCab").getValue().trim();

			if (lv_loteInseridoTela.length >= 10) {

				sap.m.MessageToast.show("Processando", {});
				//--------------------------------------------------
				// Validar se lote utilizado em outro Picking
				//--------------------------------------------------
				let oModel = this.getView().getModel();
				// let sUrl = `/PickingItem?$filter=Ticket eq '` + oModelCab.oData.ticket + `'`;
				let sUrl = `/PickingItem?$filter=Lote eq '` + lv_loteInseridoTela + `'`;
				oModel.read(sUrl ,{
                    async: true,
                    success: async function (oData, response) {

						//--------------------------------------------------
						// Validar se lote utilizado em outro Picking
						//--------------------------------------------------
						if (Array.isArray(oData.results)) {
							let ls_existe_outro_transp = oData.results.find((record) => record.Ticket != oModelCab.oData.ticket && record.Lote === lv_loteInseridoTela)
							if (!!ls_existe_outro_transp) {
								// Erro: Lote inserido é usado em outro Picking
								sap.m.MessageBox.error('Lote utilizado em outra remessa');
								//Parar processamento
								return;
							}
							//--------------------------------------------------
							// Validar se lote já é utilizado
							//--------------------------------------------------
							let ls_lote_ja_usado = oData.results.find((record) => record.Lote === lv_loteInseridoTela)
							if (!!ls_lote_ja_usado) {
								// Erro: Lote inserido é usado em outro Picking
								sap.m.MessageBox.error("Lote já foi inserido neste picking");
								//Parar processamento
								return;
							}
						}
						
						//Ler Payload Picking atual
						await this.lerSomaPickingAtual(oModelCab);
						oModelCab.oData.pesoBrutoTotal = oModelCab.oData.pesoBrutoTotal;

						// Ler e Validar lote novo inserido na tela
						let validardadosLoteNovo = await this.lerDadosParaNovoLote(oModelCab, lv_loteInseridoTela);
						if (validardadosLoteNovo === false) {
							return;
						}
						
						// Atualizar Model local Lote Novo
						oModelLoteNovo.oData.LoteNovo 			= lv_loteInseridoTela
						oModelLoteNovo.oData.Ov 				= validardadosLoteNovo.Ov;
						oModelLoteNovo.oData.OvItem 			= validardadosLoteNovo.OvItem;
						oModelLoteNovo.oData.Ticket 			= validardadosLoteNovo.Ticket;
						oModelLoteNovo.oData.Bukrs  			= validardadosLoteNovo.Bukrs;//
						oModelLoteNovo.oData.Ano    			= validardadosLoteNovo.Ano;//
						oModelLoteNovo.oData.Vstel  			= validardadosLoteNovo.Vstel;//
						oModelLoteNovo.oData.Medst				= validardadosLoteNovo.Medst;
						oModelLoteNovo.oData.Plant				= validardadosLoteNovo.Plant;
						oModelLoteNovo.oData.Matnr				= validardadosLoteNovo.Matnr,
						oModelLoteNovo.oData.Lgort				= validardadosLoteNovo.Lgort,
						oModelLoteNovo.oData.OriEstoque 		= validardadosLoteNovo.OriEstoque; //
						oModelLoteNovo.oData.PesoUltLido 		= 0;
						oModelLoteNovo.oData.PayloadLoteLido	= validardadosLoteNovo.QuantidadeLivre;
						oModelCab.oData.payload                 = validardadosLoteNovo.Payload;
						oModelLoteNovo.setData(oModelLoteNovo.oData);

						if (parseFloat(oModelCab.oData.pesoBrutoTotal) + parseFloat(oModelLoteNovo.oData.PayloadLoteLido) > oModelCab.oData.payload) {
							// Erro: Payload atingido, não é possível fazer mais picking
							sap.m.MessageBox.error('Payload atingido. Não é possível fazer mais picking');
							return;
						}

						oModelCab.oData.pesoLeitura = validardadosLoteNovo.QuantidadeLivre;
						oModelCab.oData.pesoBrutoTotal = parseFloat(oModelCab.oData.pesoBrutoTotal) + parseFloat(validardadosLoteNovo.QuantidadeLivre);
						oModelCab.setData(oModelCab.oData);

						let centroValido = await this.lerSetCentrosValidos(oModelCab);
						oModelCab.oData.ctrlUserPlantEnabled = centroValido.ctrlUserPlantEnabled;
						oModelCab.oData.ctrlPaleteObrigatorio = centroValido.ctrlPaleteObrigatorio;
						oModelCab.setData(oModelCab.oData);
						
						//Inserir Altura do Palete
						this.onOpenPaletPopup(this);

					}.bind(this),
					error: function (oError ) {

					}.bind(this),
                });

			}
		},

		//--------------------------------------------------
		// Popup Entrar Palete
		//--------------------------------------------------
		onOpenPaletPopup: function(){
			//Usuário vai entrar a Altura do Palete
			if (!this.pDialog) {
				this.pDialog = this.loadFragment({
					name: "zewmpickingtflt.view.EntrarPalete"
				});
			};
			this.pDialog.then(function(oDialog) {
				if(oDialog){
					oDialog.open();
				}
			});
		},

		onOkEntrarPalete: function(oEvent) {

			// Ler Modelo de cabeçalho, c/ dados respectivos ao Ticket/Transp atual
			let oModelCab = this.getView().getModel('modelCab');

			let lv_alturaPaleteEntradoStr = oEvent.getSource().getParent().getParent().byId("idEntrarAltPaleteInput").getValue();
			let lv_alturaPaleteEntrado = parseFloat(oEvent.getSource().getParent().getParent().byId("idEntrarAltPaleteInput").getValue());

			//--------------------------------------------------
			// Validar altura entrada pelo usuário
			//--------------------------------------------------
			if (oModelCab.oData.ctrlPaleteObrigatorio === true) {
				if (isNaN(lv_alturaPaleteEntrado) && oModelCab.oData.ctrlPaleteObrigatorio === true) {
					sap.m.MessageBox.error("Altura inválida");
				} else if (!isNaN(lv_alturaPaleteEntrado) && oModelCab.oData.ctrlPaleteObrigatorio === true && lv_alturaPaleteEntradoStr.length > 5) {
					sap.m.MessageBox.error("Formato Palete informado inválido");
				} else if (!lv_alturaPaleteEntradoStr.match(/^[0-1]*([.,][0-9]+)?$/)) {
					sap.m.MessageBox.error("Formato inválido");
				} else if (!isNaN(lv_alturaPaleteEntrado) && oModelCab.oData.ctrlPaleteObrigatorio === true && lv_alturaPaleteEntrado === '') {
					sap.m.MessageBox.error("Altura do Palete é um campo obrigatório");
				} else if ((!isNaN(lv_alturaPaleteEntrado) && oModelCab.oData.ctrlPaleteObrigatorio === true) && (lv_alturaPaleteEntrado <= 0 || lv_alturaPaleteEntrado >= 2)) {
					sap.m.MessageBox.error("Altura deve ser entre 0m e 2m");
				} else if ((!isNaN(lv_alturaPaleteEntrado) && oModelCab.oData.ctrlPaleteObrigatorio === true) && (lv_alturaPaleteEntrado > 0 || lv_alturaPaleteEntrado < 2)) {

					// Altura ok
					oModelCab.oData.alturaEntradaPalete = lv_alturaPaleteEntrado;
					oModelCab.setData(oModelCab.oData);

					// Inserir novo lote de picking
					this.inserirPicking();
					oEvent.getSource().getParent().close();
				}	
			} else if (oModelCab.oData.ctrlPaleteObrigatorio === false) {
				// Inserir novo lote de picking
				this.inserirPicking();
				oEvent.getSource().getParent().close();
			}
			 

		},

		onCancelarDialogEntrarPalete: function(oEvent) {
			
			this.getView().byId("idEntrarAltPaleteInput").setValue("");
			oEvent.getSource().getParent().close();
		},

		inserirPicking: function () {

			//--------------------------------------------------
			// Inserir Picking na tab. itens do SAP
			//--------------------------------------------------
			// ler Model locais auxiliares
			let oModelCab 		= this.getView().getModel('modelCab');
			let oModelLoteNovo 	= this.getView().getModel('modelLoteNovo');

			// Preencher dados p/ o novo item de picking
			var dados = {
				BUKRS: 			 oModelLoteNovo.oData.Bukrs,
				TRANSPORTE: 	 oModelCab.oData.transporte,
				TICKET: 		 oModelCab.oData.ticket,
				ANO: 			 oModelLoteNovo.oData.Ano,
				VSTEL: 			 oModelLoteNovo.oData.Vstel,
				LOTE: 			 oModelLoteNovo.oData.LoteNovo,
				STATUS: 		 '002',  //Em Picking
				PESO_ULT_LIDO:   String(oModelCab.oData.pesoLeitura),
				MEINS: 			 oModelLoteNovo.oData.Medst,
				FIN_CARR_USER:   '',
				//FIN_CARR_DATA: '',
				WERKS: 			 oModelLoteNovo.oData.Plant,
				MATNR: 			 oModelLoteNovo.oData.Matnr,
				LGORT: 			 oModelLoteNovo.oData.Lgort,
				VBELV: 			 oModelLoteNovo.oData.Ov,
				POSNV: 			 oModelLoteNovo.oData.OvItem,
				ORI_ESTOQUE: 	 oModelLoteNovo.oData.OriEstoque,
				USER_PICKING:    '',
				ALTURA_PALETE:   String(oModelCab.oData.alturaEntradaPalete)
				//DATA_PICKING:  ''
			};
			
			// Picking SAP Model
			let oModel = new ODataModel("/sap/opu/odata/sap/ZGWEWM_PICKING_TF_SRV");
			
			// Inserir novo item de Picking
			// Salvar novo lote lido nas tabelas ZEWMT0011S4 e ZEWMT0012S4.
			// Adiciona lote lido na lista de picking (Refresh na model do Grid).
			oModel.create("/PickingTransfSet", dados, {
				success: function (oDados, response) {
					
					// Limpar campo de input de Lote novo
					this.getView().byId("_IDGenLoteCab").setValue("");
					// Limpar campo de input de Altura Palete novo
					this.getView().byId("idEntrarAltPaleteInput").setValue("");
					// refresh no grid
					this.getView().getModel().refresh();

					// Atualizar último peso lido no Model local Cab. auxiliar
					oModelLoteNovo.oData.PesoUltLido = oModelLoteNovo.oData.PayloadLoteLido;

					//Atualizar STATUS na tela
					this.atualizarStatusTela('Em Picking', oModelCab);

					oModelLoteNovo.setData(oModelLoteNovo.oData);

					// Atualizar Peso Leitura
					oModelCab.oData.pesoLeitura = oModelLoteNovo.oData.PesoUltLido;

					sap.m.MessageBox.success("Lote inserido");

				}.bind(this),
				error: function (oError) {
					// Limpar campo de input de Lote novo
					this.getView().byId("_IDGenLoteCab").setValue("");
					// Limpar campo de input de Altura Palete novo
					this.getView().byId("idEntrarAltPaleteInput").setValue("");

					let oMessage = JSON.parse(oError.responseText);
                    let oMessage2 = (oMessage.error.innererror.errordetails[0].message);

					sap.m.MessageBox.error("Erro técnico ao inserir novo lote no picking");
				}.bind(this),
			});
		},
		//--------------------------------------------------
		// Fim - Popup Entrar Altura Palete
		//--------------------------------------------------


		//--------------------------------------------------
		// Funções p/ Eliminar Lote da lista
		//--------------------------------------------------		
		onFooterEliminarLoteClick: function(){

			// Ler Models locais auxiliares
			let oModelCab = this.getView().getModel('modelCab');
			let oModelLoteAEliminar = this.getView().getModel('modelLoteAEliminar');

			// Validar antes se pode
			if (!this.validarAcaoOk('EliminarLote',oModelCab)) {
				// Erro não pode inserir mais lotes
				sap.m.MessageBox.error('Erro. Só pode eliminar lote quando status for Em Picking');
				return;
			}

			// Ler qual lote selecionado p/ eliminação		
			let oTable = this.getView().byId("idPickingTransfTable");
			let oItem = oTable.getSelectedItem();
			let oEntry;
			if (!!oItem) {
				oEntry = oItem.getBindingContext().getObject();	
			}
			if (!!oEntry && oEntry.Lote) {
				oModelLoteAEliminar.oData.LoteAEliminar = oEntry.Lote;
				oModelLoteAEliminar.setData(oModelLoteAEliminar.oData);
			} else {
				// Não tem ainda o código do Lote a eliminar
				// O usuário vai ter que digitar o lote no popup
				oModelLoteAEliminar.oData.LoteAEliminar = '';
				oModelLoteAEliminar.setData(oModelLoteAEliminar.oData);
			}

			this.onEliminarLotePopup();


		},

		onEliminarLotePopup: function(){
			//Usuário vai Digitar o lote a ser Eliminado no grid
			if (!this.pDialogEliminarLote) {
				this.pDialogEliminarLote = this.loadFragment({
					name: "zewmpickingtflt.view.EliminarLote"
				});
			};
			this.pDialogEliminarLote.then(function(oDialog) {
				if(oDialog){
					oDialog.open();
				}
			});
		},

		onFecharPopupElimLoteClick: function(oEvent) {
			
			this.getView().byId("idElimLoteInput").setValue("");
			oEvent.getSource().getParent().close();
		},

		onOkPopupElimLoteClick: async function(oEvent){
			
			// Ler lote digitado p/ eliminar
			let loteAEliminar = this.getView().byId("idElimLoteInput").getValue();
			if (loteAEliminar === '') {
				sap.m.MessageBox.error("Preencher lote a eliminar");
				return;
			}

			// Ler Model local com dados cab.
			let oModelCab 				= this.getView().getModel('modelCab');
			let oModelLoteNovo  		= this.getView().getModel('modelLoteNovo');
			// let oModelLotesJaCarregados = this.getView().getModel('modelLotesJaCarregados');
			
			//--------------------------------------------------
			// Validar se o lote existe no Grid
			//--------------------------------------------------
			let oModel = this.getView().getModel();
			let sUrl = `/PickingTransfNovo?$filter=Ticket eq '` + oModelCab.oData.ticket + `',Transporte eq '` + oModelCab.oData.transporte + `'`;
			oModel.read(sUrl , { 
				async: true,
				success: function (oData, response) {
					if (Array.isArray(oData.results)) {
						let ls_DadosLoteAEliminar = oData.results.find((record) => record.Lote === loteAEliminar)
						if (!ls_DadosLoteAEliminar) {
							// Erro: Lote não existe na lista, não dá p/ eliminar.
							sap.m.MessageBox.error("Não foi efetuado o picking deste lote. Impossível eliminar");
							//Parar processamento
							return;
						}

						//--------------------------------------------------
						// Eliminar Lote da lista de picking
						//--------------------------------------------------
						// Eliminar o lote do grid e da tabela de picking
						// Picking SAP Model
						let oModel_SEGW_PICKING_TF = new ODataModel("/sap/opu/odata/sap/ZGWEWM_PICKING_TF_SRV");
						let sUrl = `/PickingTransfSet(BUKRS='` + ls_DadosLoteAEliminar.Bukrs + `',TRANSPORTE='` + ls_DadosLoteAEliminar.Transporte + `',TICKET='` + ls_DadosLoteAEliminar.Ticket + `',ANO='` + ls_DadosLoteAEliminar.Ano + `',VSTEL='` + ls_DadosLoteAEliminar.Vstel + `',LOTE='` + loteAEliminar + `')`;
						oModel_SEGW_PICKING_TF.remove(sUrl, {
							async: true,
							success: async function (oData, response) {
								
								// Diminuir a qtde de Bobinas do cab.
								oModelCab.oData.quantidadeBoninas--;
								// oModelCab.setData(oModelCab.oData);

								//ler soma atualizada de peso do picking atual
								let lv_oModelCab = await this.lerSomaPickingAtual(oModelCab);
								oModelCab = lv_oModelCab;

								// refresh no grid dos lotes de picking atual
								let oViewModel = this.getView().getModel().refresh();

								// Fechar o popup de eliminar lote
								this.getView().byId("idElimLoteInput").setValue("");
								try {
									oEvent.getSource().getParent().close();
								} catch (error) {
									//não havia popup. não há erro aqui.
								}
								
								sap.m.MessageBox.success("Lote eliminado do picking");

							}.bind(this),
							error: function (Error) {
								sap.m.MessageBox.error("Erro técnico ao Eliminar lote no picking");
							}.bind(this),
						});

					}
				}.bind(this),
				error: function (Error) {
					sap.m.MessageBox.error("Erro técnico ao Eliminar lote no picking");
				}.bind(this),				
			});
		},
		//--------------------------------------------------
		// Fim - Funções p/ Eliminar Lote da lista
		//--------------------------------------------------

		//--------------------------------------------------
		// ini - funções pop Up Ler Dep. Destino.
		//--------------------------------------------------
		popUpLerDepDestino: function(){

			//Usuário vai Digitar o Dep. Destino
			if (!this.pDialogDepDestino) {
				this.pDialogDepDestino = this.loadFragment({
					name: "zewmpickingtflt.view.EntrarDepDestino"
				});
			};
			this.pDialogDepDestino.then(function(oDialog) {
				if(oDialog){
					oDialog.open();
				}
			});
		},

		onFecharClickEntrarDepDestino: function(oEvent) {
			
			this.getView().byId("idInputEntrarDepDest").setValue("");
			oEvent.getSource().getParent().close();
		},

		onOkClickEntrarDepDestino: function(oEvent){
			
			// Ler Dep. Destino
			let depositoDestino = String(this.getView().byId("idInputEntrarDepDest").getValue()).toUpperCase();
			//validar Dep. Destino entrado
			if (depositoDestino === '') {
				sap.m.MessageBox.error("Depósito Destino é obrigatório");
				return;
			}
			
			// ler Model local auxiliar
			let oModelCab 		= this.getView().getModel('modelCab');
			let oModelLoteNovo 	= this.getView().getModel('modelLoteNovo');

			// Ler Qtde Bobinas informada no popup
			let qtdeBobinasContraPickingInformada = parseInt(oModelCab.oData.QtdeBobinasContraPicking);
			//atualizar Dep.Dest. no model local
			oModelCab.oData.DepDestino = depositoDestino;
			oModelCab.setData(oModelCab.oData);

			// Validar antes se pode
			if (!this.validarAcaoOk('Finalizar',oModelCab)) {
				// Erro não pode inserir mais lotes
				sap.m.MessageBox.error('Só pode finalizar quando status for Em Picking');
				return;
			}

			// Validar Se QTDE INFORMADA <> QTDE BOBINAS DO CABEÇALHO
			if (qtdeBobinasContraPickingInformada != oModelCab.oData.quantidadeBoninas) {
				// Erro
				sap.m.MessageBox.error('Quantidade informada divergente do registrado no picking');
				return;

			// Validar QTDE BOBINAS DO CABEÇALHO = 0
			} else if (oModelCab.oData.quantidadeBoninas === 0) {
				// Erro
				sap.m.MessageBox.error('Não pode finalizar com Qtde. Bonbinas 0');
				
			//--------------------------------------------------
			// Finalizar
			//--------------------------------------------------
			} else {

				this.finalizar(oEvent,oModelCab);

			}

			
		},
		//--------------------------------------------------
		// fim - Funções pop Up Ler Dep. Destino.
		//--------------------------------------------------

		//--------------------------------------------------
		// ini - Funções p/ Botão Finalizar
		//--------------------------------------------------
		onFooterFinalizarClick: function(){
			
			// ler Model local auxiliar
			let oModelCab 		= this.getView().getModel('modelCab');

			// Validar QTDE BOBINAS DO CABEÇALHO = 0
			if (oModelCab.oData.quantidadeBoninas === 0) {
				// Erro
				sap.m.MessageBox.error('Erro. Não pode finalizar com Qtde. Bonbinas 0');
				return;
			}

			this.abrirPopupEntrarContraPicking();

		},

		abrirPopupEntrarContraPicking: function(){
			// Usuário vai Digitar a QTDE de Bobinas p/ Contra Picking
			if (!this.pDialogEntrarContraPicking) {
				this.pDialogEntrarContraPicking = this.loadFragment({
					name: "zewmpickingtflt.view.EntrarContraPicking"
				});
			};
			this.pDialogEntrarContraPicking.then(function(oDialog) {
				if(oDialog){
					oDialog.open();
				}
			});
		},

		onOkClickEntrarContraPicking: function(oEvent){

			// Ler Qtde Bobinas informada no popup
			let qtdeBobinasContraPickingInformada = parseInt(this.getView().byId("idInputEntrarContraPicking").getValue());

			//fechar Popup Entrar Contra Picking
			if (qtdeBobinasContraPickingInformada === '') {
				sap.m.MessageBox.error('Contrapicking é obrigatório');
						
			} else if (!String(qtdeBobinasContraPickingInformada).match(/^[1-9]$/)) {
				sap.m.MessageBox.error("Formato inválido");

			} else {

				
				//fechar popup contrapicking
				oEvent.getSource().getParent().close();

				//guardar qtde contrapicking no model local auxiliar
				let oModelCab 		= this.getView().getModel('modelCab');
				oModelCab.oData.QtdeBobinasContraPicking = qtdeBobinasContraPickingInformada;
				oModelCab.setData(oModelCab.oData);

				// chamar popup dep. dest.
				this.popUpLerDepDestino();
			}
		},

		onFecharClickEntrarContraPicking: function(oEvent){

			this.getView().byId("idInputEntrarContraPicking").setValue("");
			oEvent.getSource().getParent().close();
		
		},

		showBusyDialog: function () {
			// load BusyDialog fragment asynchronously
			if (!this._pBusyDialog) {
				this._pBusyDialog = Fragment.load({
					name: "zewmpickingtflt.view.EntrarContraPicking",
					controller: this
				}).then(function (oBusyDialog) {
					this.getView().addDependent(oBusyDialog);
					syncStyleClass("sapUiSizeCompact", this.getView(), oBusyDialog);
					return oBusyDialog;
				}.bind(this));
			}

			this._pBusyDialog.then(function(oBusyDialog) {
				oBusyDialog.open();
				this.simulateServerRequest();
			}.bind(this));
		},

		simulateServerRequest: function () {
			// simulate a longer running operation
			iTimeoutId = setTimeout(function() {
				this._pBusyDialog.then(function(oBusyDialog) {
					oBusyDialog.close();
				});
			}.bind(this), 2000);
		},

		finalizar: async function(oEventPopupDepDestConfirmar, oModelCab){
			
			sap.m.MessageBox.show("Processando");
			const data = await this.validarDados(oModelCab);
	 
			//--------------------------------------------------
			// Ini Finalizar no SAP
			//--------------------------------------------------
			let dados = {
				BUKRS:           data.oData.Bukrs,
				TRANSPORTE:      data.oData.transporte,
				TICKET:          data.oData.ticket,
				ANO:             data.oData.Ano,
				VSTEL:           data.oData.Vstel,
				DEP_DESTINO:     data.oData.DepDestino
			};

			let vUrl = '/sap/opu/odata/sap/ZGWEWM_PICKING_TF_SRV/';
			let oData = new sap.ui.model.odata.v2.ODataModel(vUrl);
	 
			oData.create("/RemessaSet", dados, {
				success: function (oData, response) {
					data.oData.statusCarregamento = 'Picking em processamento';
					data.setData(data.oData);
					//fechar popup Dep. Destino
					oEventPopupDepDestConfirmar.getSource().getParent().close();
				},
				error: function (error) {
					sap.m.MessageBox.error('Erro técnico ao chamar o SAP');
					//fechar popup Dep. Destino
					oEventPopupDepDestConfirmar.getSource().getParent().close();
				}
			});
		},
		//--------------------------------------------------
		// Fim - Funções p/ Botão Finalizar
		//--------------------------------------------------

		//--------------------------------------------------
		// Ini - Funções auxiliares
		//--------------------------------------------------
		atualizarStatusTela: function(novoStatus, oModelCab){
			let lv_oModelCab = [];
			if (!!oModelCab) {
				lv_oModelCab = oModelCab;	
			} else {
				lv_oModelCab = this.getView().getModel('modelCab');
			}
			lv_oModelCab.oData.statusCarregamento  = novoStatus;
			//não precisaria, mas tenho que forçar p/ atualizar o campo na tela na hora
			lv_oModelCab.setData(oModelCab.oData);
		},
		lerStatusAtual: function(oModelCab){
			// let lv_oModelCab = [];
			// if (!!oModelCab) {
			// 	lv_oModelCab = oModelCab;	
			// } else {
			// 	lv_oModelCab = this.getView().getModel('modelCab');
			// }
			// return lv_oModelCab.oData.statusCarregamento;
			return oModelCab.oData.statusCarregamento;
		},

		validarAcaoOk: function(sAcao, oModelCab){
			switch (sAcao) {
				case 'InserirLote': 
					if (this.lerStatusAtual(oModelCab) === 'Inicial' || this.lerStatusAtual(oModelCab) === 'Em Picking') {
						//ok
						return true;
					}
					break;

				case 'EliminarLote': 
					if (this.lerStatusAtual(oModelCab) === 'Em Picking') {
						//ok
						return true;
					}
					break;

				case 'Finalizar':
					if (this.lerStatusAtual(oModelCab) === 'Em Picking') {
						//ok
						return true;
					}
					break;
					
				default:
					// por default, retornar action invalida
					return false;
					break;
			}
		},
		definirPesoLeitura: function(){
			// Atualizar Peso Leitura
			oModelCab.oData.pesoLeitura = 0;
		},

		validarDados: async function(oModelCab){
            return new Promise((resolve, reject)=> {
                if(oModelCab.oData.Bukrs && oModelCab.oData.Ano && oModelCab.oData.Vstel){
                    resolve(oModelCab); //já estão preenchidas: retornar
                }

                let oModel = this.getView().getModel();
                let sUrl = `/PickingTransf?$filter=Transporte eq '` + oModelCab.oData.transporte + `' and Ticket eq '` + oModelCab.oData.ticket + `'`;
                oModel.read(sUrl, {
                    async: true,
                    success: function (oData) {
                        if (Array.isArray(oData.results) && oData.results.length > 0) {
                            let pickingAtual = oData.results.find((record) => record.Transporte === oModelCab.oData.transporte)
                            if (!!pickingAtual) {
                                oModelCab.oData.Bukrs  = pickingAtual.Bukrs;
                                oModelCab.oData.Ano    = pickingAtual.Ano;
                                oModelCab.oData.Vstel  = pickingAtual.Vstel;
                                resolve(oModelCab); //retornar campos já preenchidos
                            }
                        }
                    }.bind(this),
                    error: function (Error) {
                        sap.m.MessageBox.error("Erro técnico ao ler Picking Transf. no SAP");
                        reject(); //retornar promise com erro técnico
                    }.bind(this),
                });
        	});
    	},
		lerSomaPickingAtual: async function(oModelCab){
			return new Promise((resolve, reject)=> {
                let oModel = this.getView().getModel();
				let sUrl = `/SomaCargasJaUsadasMesmoPicking?$filter=Transporte eq '` + oModelCab.oData.transporte + `' and Ticket eq '` + oModelCab.oData.ticket + `'`;
                oModel.read(sUrl, {
                    async: true,
                    success: function (oData) {
                        if (Array.isArray(oData.results) && oData.results.length > 0) {
                            let pickingAtual = oData.results.find((record) => record.Transporte === oModelCab.oData.transporte)
                            if (!!pickingAtual) {
                                oModelCab.oData.pesoBrutoTotal = oData.results[0].QuantidadePickingAtual;
                                resolve(oModelCab); //retornar campos já preenchidos
                            } else {
								oModelCab.oData.pesoBrutoTotal = 0;
                                resolve(oModelCab); //retornar campos já preenchidos
							}
                        }
                    }.bind(this),
                    error: function (Error) {
                        sap.m.MessageBox.error("Erro técnico ao ler Picking Transf. no SAP");
                        reject(); //retornar promise com erro técnico
                    }.bind(this),
                });
        	});
		},

		lerCabPickingAtual: async function(oModelCab){
			return new Promise((resolve, reject)=> {
                let oModel = this.getView().getModel();
				let sUrl = `/PickingCab?$filter=Transporte eq '` + oModelCab.oData.transporte + `' and Ticket eq '` + oModelCab.oData.ticket + `'`;
                oModel.read(sUrl, {
                    async: true,
                    success: function (oData) {
                        if (Array.isArray(oData.results) && oData.results.length > 0) {
                            let pickingAtual = oData.results.find((record) => record.Transporte === oModelCab.oData.transporte)
                            if (!!pickingAtual) {
                                oModelCab.oData.pesoLeitura = oData.results[0].PesoUltLido;
                                resolve(oModelCab); //retornar campos já preenchidos
                            } else {
								oModelCab.oData.pesoLeitura = 0;
                                resolve(oModelCab); //retornar campos já preenchidos
							}
                        }
                    }.bind(this),
                    error: function (Error) {
                        sap.m.MessageBox.error("Erro técnico ao ler Picking Transf. no SAP");
                        reject(); //retornar promise com erro técnico
                    }.bind(this),
                });
        	});
		},

		lerDadosParaNovoLote: async function(oModelCab, lv_loteInseridoTela){
			return new Promise((resolve, reject)=> {
				let oModel = this.getView().getModel();
				let sUrl = `/LoteNovo(p_lote_novo='` + lv_loteInseridoTela + `',p_transporte='` + oModelCab.oData.transporte + `',p_ticket='` + oModelCab.oData.ticket + `')/Set`;
                oModel.read(sUrl, {
                    async: true,
                    success: function (oData) {
                        if (Array.isArray(oData.results) && oData.results.length > 0) {
                            let pickingAtual = oData.results.find((record) => record.Transporte === oModelCab.oData.transporte && record.Ticket === oModelCab.oData.ticket)
                            if (!!pickingAtual) {
								if (pickingAtual.Matnr != '' && pickingAtual.QuantidadeLivre === '0.000') {
									// Erro: Lote Bloqueado, não pode ser transportado
									sap.m.MessageBox.error('Lote Bloqueado, não pode ser transportado');
									resolve(false); //retornar erro na validação
								}
								if (pickingAtual.Matnr === '') {
									// Erro: Lote não encontrado
									sap.m.MessageBox.error('Lote não encontrado');
									resolve(false); //retornar erro na validação
								}
								if (pickingAtual.Lgpla === '') {
									// Erro: Estoque não encontrado no EWM
									sap.m.MessageBox.error('Estoque não encontrado no EWM');
									resolve(false); //retornar erro na validação
								}
								if (pickingAtual.Skzua === true) {
									// Erro: Posição deste lote está bloqueada para saída
									sap.m.MessageBox.error('Posição deste lote está bloqueada para saída');
									resolve(false); //retornar erro na validação
								}
								if (pickingAtual.Skzsi === true) {
									// Erro: Posição deste lote está bloqueada para inventário
									sap.m.MessageBox.error('Posição deste lote está bloqueada para inventário');
									resolve(false); //retornar erro na validação
								}
								resolve(pickingAtual);
                            } else {
                                reject(false); //retornar campos já preenchidos
							}
                        }
                    }.bind(this),
                    error: function (Error) {
                        sap.m.MessageBox.error("Erro técnico ao ler Picking Transf. no SAP");
                        reject(); //retornar promise com erro técnico
                    }.bind(this),
                });
        	});
		},

		lerSetCentrosValidos: async function(oModelCab){
			return new Promise((resolve, reject)=> {
				let oModel = this.getView().getModel();
				let sUrl = `/SetCentrosParaPicking()`;
				let dados = {};
				oModel.read(sUrl ,{
					async: true,
					success: function (oData) {
						if (Array.isArray(oData.results) && oData.results.length > 0) {
							let centroValido = oData.results.find((record) => record.Plant === oModelCab.oData.UserPlant)
							if (!!centroValido) {
								// É editável e obrigatório
								dados.ctrlUserPlantEnabled = true;
								dados.ctrlPaleteObrigatorio = true;
								resolve(dados);
							} else {
								// Não editável e Não obrigatório
								dados.ctrlUserPlantEnabled = false;
								dados.ctrlPaleteObrigatorio = false;
								resolve(dados);
							}
						}
					}.bind(this),
					error: function (oError ) {
						sap.m.MessageBox.error('Erro ao buscar SET de Centros obrigatórios');
						reject();
					}.bind(this)
				});
			});
		}

		//--------------------------------------------------
		// Fim - Funções auxiliares
		//--------------------------------------------------
    });
});