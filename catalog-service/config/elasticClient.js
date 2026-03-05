const { Client } = require('@elastic/elasticsearch');
const { response } = require('express');

const client = new Client({
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
});

client.info()
    .then(response => console.log('✅ Connected to Elasticsearch'))
    .catch(error => console.error('❌ Elasticsearch connection error:', error));
    
module.exports = client;

