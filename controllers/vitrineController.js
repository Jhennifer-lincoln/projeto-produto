const PedidoItemModel = require("../models/pedidoItemModel");
const PedidoModel = require("../models/pedidoModel");
const ProdutoModel = require("../models/produtoModel");
const common = require('oci-common');
const queue = require('oci-queue');

class VitrineController {

    async listarProdutosView(req, res) {
        let produto = new ProdutoModel();
        let listaProdutos = await produto.listarProdutos();

        res.render('vitrine/index', { produtos: listaProdutos, layout: 'vitrine/index' });
    }

    async gravarPedido(req, res){
        var ok = false;
        var msg = "";
        
        if(req.body != null && req.body.carrinho != null) {               
            let pedido = new PedidoModel();
            let listaPedido = req.body.carrinho;
            let emailUsuario = req.body.email;
            
            let listaErros = await pedido.validarPedido(listaPedido);
            if(listaErros.length == 0){
                await pedido.gravar();
                if(pedido.pedidoId > 0){
                    ok = true;
                    let itensFila = [];
                    let valorTotalCalculado = 0;

                    for(let i = 0; i<listaPedido.length; i++){
                        let pedidoItem = new PedidoItemModel();
                        pedidoItem.pedidoId = pedido.pedidoId;
                        pedidoItem.produtoId = listaPedido[i].id;
                        pedidoItem.pedidoQuantidade = listaPedido[i].quantidade;

                        let itemOk = await pedidoItem.gravar();
                        if(itemOk){
                            pedido.debitarQuantidade(pedidoItem.produtoId, pedidoItem.pedidoQuantidade);
                            
                            itensFila.push({
                                nome: listaPedido[i].nome || `Produto #${listaPedido[i].id}`,
                                quantidade: listaPedido[i].quantidade
                            });
                            
                            let precoItem = parseFloat(listaPedido[i].preco || 0);
                            valorTotalCalculado += precoItem * parseInt(listaPedido[i].quantidade);
                        } else {
                            ok = false;
                        }
                    }

                    if(ok && emailUsuario) {
                        try {
                            const provider = new common.ConfigFileAuthenticationDetailsProvider("./.oci/config");
                            const queueClient = new queue.QueueClient({ authenticationDetailsProvider: provider });
                            
                            queueClient.endpoint = "https://cell-1.queue.messaging.sa-saopaulo-1.oci.oraclecloud.com";
                            const queueId = "ocid1.queue.oc1.sa-saopaulo-1.amaaaaaajbuj7aiaqgenejzrtlxr36yxe6gn3movehyh3mpsadi33iwyyq5q"; 

                            const payloadMensagem = {
                                numeroPedido: pedido.pedidoId,
                                emailCliente: emailUsuario,
                                itens: itensFila,
                                valorTotal: valorTotalCalculado.toFixed(2)
                            };

                            const putMessagesDetails = {
                                messages: [
                                    {
                                        content: JSON.stringify(payloadMensagem)
                                    }
                                ]
                            };

                            await queueClient.putMessages({ 
                                queueId: queueId,
                                putMessagesDetails: putMessagesDetails });
                            msg = "Pedido finalizado com sucesso! O comprovativo será enviado por e-mail.";
                        } catch (queueError) {
                            console.error("Erro de comunicação ao publicar mensagem na Fila da OCI:", queueError);
                            msg = "Pedido gerado com sucesso, mas houve uma oscilação no envio do e-mail informativo.";
                        }
                    }
                }
                else{
                    msg = "Erro ao gerar pedido no banco de dados!";
                }
            }
            else{
                var msgErro = listaErros.join("\n");  
                msgErro = msgErro.trim(",");
                msg = "Os seguintes produtos não possuem a quantidade desejada: \n" + msgErro;  
            }
        }
        else{
            msg = "Parâmetros inválidos ou estrutura do carrinho corrompida.";
        }

        res.send({ok: ok, msg: msg});
    }
}

module.exports = VitrineController;