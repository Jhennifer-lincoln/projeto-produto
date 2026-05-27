const CategoriaModel = require("../models/categoriaModel");
const MarcaModel = require("../models/marcaModel");
const ProdutoModel = require("../models/produtoModel");
const fs = require('fs');
const os = require('oci-objectstorage');
const common = require('oci-common');

class ProdutoController {

    async listarView(req, res) {
        let prod = new ProdutoModel();
        let lista = await prod.listarProdutos();
        res.render('produto/listar', {lista: lista});
    }

    async buscaProduto(req, res) {
        var ok = true;
        var msg = ""
        var retorno = null;
        if(req.body.id != null && req.body.id != ""){
            let prod = new ProdutoModel();
            prod = await prod.buscarProduto(req.body.id);

            retorno = {
                nome: prod.produtoNome,
                preco: prod.produtoPreco,
                id: prod.produtoId,
                marcaNome: prod.marcaNome,
                categoriaNome: prod.categoriaNome,
                imagem: prod.produtoImagem
            };
        }
        else {
            ok = false;
            msg = "Parâmetro inválido!";
        }

        res.send({ ok: ok, msg: msg, retorno: retorno })
    }

    async excluirProduto(req, res){
        var ok = true;
        if(req.body.codigo != "") {
            let produto = new ProdutoModel();
            ok = await produto.excluir(req.body.codigo);
        }
        else{
            ok = false;
        }

        res.send({ok: ok});
    }

    async cadastrarProduto(req, res){
        var ok = true;
        if(req.body.codigo != "" && req.body.nome != "" && req.body.quantidade != "" && req.body.quantidade  != '0' && req.body.marca != '0' && req.body.categoria  != '0' && req.file != null && (req.file.originalname.includes(".jpg") || req.file.originalname.includes(".png")) && req.body.preco != '' && req.body.preco > '0' ) {
            
            try {
                const provider = new common.ConfigFileAuthenticationDetailsProvider("./.oci/config");
                const client = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });

                const namespace = "gr53ly2ey5yi"; // Substitua pelo Namespace obtido na OCI
                const bucketName = "bucket-atividadeFinal";   // Nome do seu Bucket criado na OCI
                const nomeFicheiroCloud = Date.now().toString() + "-" + req.file.originalname;

                const putObjectRequest = {
                    namespaceName: namespace,
                    bucketName: bucketName,
                    putObjectBody: req.file.buffer, 
                    objectName: nomeFicheiroCloud,
                    contentLength: req.file.size,
                    contentType: req.file.mimetype
                };

                await client.putObject(putObjectRequest);

                // Constrói o URL público de visualização do objeto na OCI
                const imageUrl = `https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/${namespace}/b/${bucketName}/o/${nomeFicheiroCloud}`;

                let produto = new ProdutoModel(0, req.body.codigo, req.body.nome, req.body.quantidade, req.body.categoria, req.body.marca, "", "", imageUrl, req.body.preco);
                ok = await produto.gravar();
            } catch (error) {
                console.error("Erro ao realizar upload para o Object Storage da OCI:", error);
                ok = false;
            }
        }
        else{
            ok = false;
        }

        res.send({ ok: ok })
    }

    async alterarView(req, res){
        let produto = new ProdutoModel();
        let marca = new MarcaModel();
        
        let categoria = new CategoriaModel();
        if(req.params.id != undefined && req.params.id != ""){
            produto = await produto.buscarProduto(req.params.id);
        }

        let listaMarca = await marca.listarMarcas();
        let listaCategoria = await categoria.listarCategorias();
        res.render("produto/alterar", {produtoAlter: produto, listaMarcas: listaMarca, listaCategorias: listaCategoria});
    }

    async alterarProduto(req, res) {
        var ok = true;
        if(req.body.codigo != "" && req.body.nome != "" && req.body.quantidade != "" && req.body.quantidade  != '0' && req.body.marca != '0' && req.body.categoria  != '0' && req.file != null && (req.file.originalname.includes(".jpg") || req.file.originalname.includes(".png"))  && req.body.preco != '' && req.body.preco > '0' ) {

            try {
                const provider = new common.ConfigFileAuthenticationDetailsProvider("./.oci/config");
                const client = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });

                const namespace = "gr53ly2ey5yi"; 
                const bucketName = "bucket-atividadeFinal";
                const nomeFicheiroCloud = Date.now().toString() + "-" + req.file.originalname;

                const putObjectRequest = {
                    namespaceName: namespace,
                    bucketName: bucketName,
                    putObjectBody: req.file.buffer,
                    objectName: nomeFicheiroCloud,
                    contentLength: req.file.size,
                    contentType: req.file.mimetype
                };
                await client.putObject(putObjectRequest);

                const imageUrl = `https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/${namespace}/b/${bucketName}/o/${nomeFicheiroCloud}`;
                
                let produto = new ProdutoModel(req.body.id, req.body.codigo, req.body.nome, req.body.quantidade, req.body.categoria, req.body.marca, "", "", imageUrl, req.body.preco);
                let produtoOld = await produto.buscarProduto(req.body.id);

                if(produtoOld.produtoImagem != null && produtoOld.produtoImagem.includes("/o/")) {
                    try {
                        const partes = produtoOld.produtoImagem.split("/o/");
                        const objetoAntigo = partes[partes.length - 1];
                        
                        const deleteObjectRequest = {
                            namespaceName: namespace,
                            bucketName: bucketName,
                            objectName: objetoAntigo
                        };
                        await client.deleteObject(deleteObjectRequest);
                    } catch (errDelete) {
                        console.error("Aviso: Não foi possível remover o objeto antigo do Bucket:", errDelete.message);
                    }
                }
                
                ok = await produto.gravar();
            } catch (error) {
                console.error("Erro ao alterar produto no Object Storage:", error);
                ok = false;
            }
        }
        else{
            ok = false;
        }

        res.send({ ok: ok })
    }

    async cadastroView(req, res) {
        let listaMarcas = [];
        let listaCategorias = [];

        let marca = new MarcaModel();
        listaMarcas = await marca.listarMarcas();

        let categoria = new CategoriaModel();
        listaCategorias = await categoria.listarCategorias();

        res.render('produto/cadastro', { listaMarcas: listaMarcas, listaCategorias: listaCategorias });
    }
}

module.exports = ProdutoController;