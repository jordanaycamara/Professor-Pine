"use strict";

const log = require('loglevel').getLogger('DB'),
    knex = require('knex')

class DBManager {
    constructor() {
        this.connection = null;

        this.guilds = new Map();

        this.knex = knex({
            client: 'mysql',
            connection: {
                host: process.env.CLEARDB_HOST,
                user: process.env.CLEARDB_USER,
                password: process.env.CLEARDB_PASSWORD,
                database: process.env.CLEARDB_SCHEMA
            },
            migrations: {
                directory: './app/db'
            },
            debug: true
        });
    }

    initialize(client) {
        this.knex.migrate.latest()
            .then(() => client.guilds.forEach(guild =>
                this.insertIfAbsent('Guild', Object.assign({}, {
                    snowflake: guild.id
                }))
                .catch(err => log.error(err))))
            .catch(err => log.error(err));

        client.on('guildCreate', guild =>
            this.insertIfAbsent('Guild', Object.assign({}, {
                snowflake: guild.id
            }))
            .catch(err => log.error(err)));

        client.on('guildDelete', guild => {
            this.DB('Guild')
                .where('snowflake', guild.id)
                .del()
                .catch(err => log.error(err));
        });
    }

    get DB() {
        return this.knex;
    }

    insertIfAbsent(table_name, data, transaction = undefined) {
        const first_data = data[0] ?
            data[0] :
            data,
            object_properties = Object.getOwnPropertyNames(first_data),
            exists_query = this.knex(table_name)
            .where(object_properties[0], first_data[object_properties[0]]);

        for (let i = 1; i < object_properties.length; i++) {
            exists_query
                .andWhere(object_properties[i], first_data[object_properties[i]]);
        }

        return exists_query
            .first()
            .then(result => {
                if (!result) {
                    return transaction ?
                        this.knex(table_name).transacting(transaction)
                        .insert(first_data)
                        .returning('id') :
                        this.knex(table_name)
                        .insert(first_data)
                        .returning('id');
                } else {
                    return [result.id];
                }
            });
    }
}

module.exports = new DBManager();