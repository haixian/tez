/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

App.DagVerticesController = App.TablePageController.extend({
  controllerName: 'DagVerticesController',
  needs: "dag",

  entityType: 'dagVertex',
  filterEntityType: 'dag',
  filterEntityId: Ember.computed.alias('controllers.dag.id'),

  cacheDomain: Ember.computed.alias('controllers.dag.id'),

  beforeLoad: function () {
    var dagController = this.get('controllers.dag'),
        model = dagController.get('model');
    return model.reload().then(function () {
      return dagController.loadAdditional(model);
    });
  },

  afterLoad: function () {
    var data = this.get('data'),
        runningVerticesIdx,
        isUnsuccessfulDag = App.Helpers.misc.isStatusInUnsuccessful(
          this.get('controllers.dag.status')
        );

    if(isUnsuccessfulDag) {
      data.filterBy('status', 'RUNNING').forEach(function (vertex) {
        vertex.set('status', 'KILLED');
      });
    }

    this._loadProgress(data);

    return this._super();
  },

  // Load progress in parallel
  _loadProgress: function (vertices) {
    var that = this,
        runningVerticesIdx = vertices
      .filterBy('status', 'RUNNING')
      .map(function(item) {
        return item.get('id').split('_').splice(-1).pop();
      });

    if (runningVerticesIdx.length > 0) {
      this.store.unloadAll('vertexProgress');
      this.store.findQuery('vertexProgress', {
        metadata: {
          appId: that.get('applicationId'),
          dagIdx: that.get('idx'),
          vertexIds: runningVerticesIdx.join(',')
        }
      }).then(function(vertexProgressInfo) {
        vertexProgressInfo.forEach(function(item) {
          var model = vertices.findBy('id', item.get('id')) || Em.Object.create();
          model.set('progress', item.get('progress'));
        });
      }).catch(function(error) {
        Em.Logger.debug("failed to fetch vertex progress")
      });
    }
  },

  defaultColumnConfigs: function() {
    var that = this;

    function onProgressChange() {
      var progress = this.get('vertex.progress'),
          pct;
      if (Ember.typeOf(progress) === 'number') {
        pct = App.Helpers.number.fractionToPercentage(progress);
        this.set('progress', pct);
      }
    }

    return [
      {
        id: 'vertexName',
        headerCellName: 'Vertex Name',
        templateName: 'components/basic-table/linked-cell',
        contentPath: 'name',
        getCellContent: function(row) {
          return {
            linkTo: 'vertex',
            entityId: row.get('id'),
            displayText: row.get('name')
          };
        }
      },
      {
        id: 'id',
        headerCellName: 'Vertex ID',
        contentPath: 'id',
      },
      {
        id: 'status',
        headerCellName: 'Status',
        templateName: 'components/basic-table/status-cell',
        contentPath: 'status',
        getCellContent: function(row) {
          var status = row.get('status'),
              content = Ember.Object.create({
                vertex: row,
                status: status,
                statusIcon: App.Helpers.misc.getStatusClassForEntity(status,
                  row.get('hasFailedTaskAttempts'))
              });

          if(status == 'RUNNING') {
            row.addObserver('progress', content, onProgressChange);
          }
          return content;
        }
      },
      {
        id: 'startTime',
        headerCellName: 'Start Time',
        contentPath: 'startTime',
        getCellContent: function(row) {
          return App.Helpers.date.dateFormat(row.get('startTime'));
        },
        getSearchValue: function(row) {
          return App.Helpers.date.dateFormat(row.get('startTime'));
        }
      },
      {
        id: 'endTime',
        headerCellName: 'End Time',
        contentPath: 'endTime',
        getCellContent: function(row) {
          return App.Helpers.date.dateFormat(row.get('endTime'));
        },
        getSearchValue: function(row) {
          return App.Helpers.date.dateFormat(row.get('endTime'));
        },
      },
      {
        id: 'duration',
        headerCellName: 'Duration',
        contentPath: 'duration',
        getCellContent: function(row) {
          return App.Helpers.date.timingFormat(row.get('duration'), 1);
        },
        getSearchValue: function(row) {
          return App.Helpers.date.timingFormat(row.get('duration'), 1);
        }
      },
      {
        id: 'firstTaskStartTime',
        headerCellName: 'First Task Start Time',
        contentPath: 'firstTaskStartTime',
        getCellContent: function(row) {
          return App.Helpers.date.dateFormat(row.get('firstTaskStartTime'));
        },
        getSearchValue: function(row) {
          return App.Helpers.date.dateFormat(row.get('firstTaskStartTime'));
        }
      },
      {
        id: 'tasks',
        headerCellName: 'Tasks',
        contentPath: 'numTasks'
      },
      {
        id: 'processorClass',
        headerCellName: 'Processor Class',
        contentPath: 'processorClassName'
      },
      {
        id: 'configurations',
        headerCellName: 'Source/Sink Configs',
        templateName: 'components/basic-table/vertex-configurations-cell',
        searchAndSortable: false,
        getCellContent: function(row) {
          var firstInputId = row.get('inputs.content.0.id'),
              firstOutputId = row.get('outputs.content.0.id');
          return {
            linkToAdditionals: row.get('inputs.content.length') > 1 ||
                row.get('outputs.content.length') > 1 ||
                (firstInputId != undefined && firstOutputId != undefined),
            inputId: firstInputId,
            outputId: firstOutputId,
            vertexId: row.get('id')
          };
        }
      }
    ];
  }.property('id'),

  columnConfigs: function() {
    return this.get('defaultColumnConfigs').concat(
      App.Helpers.misc.normalizeCounterConfigs(
        App.get('Configs.defaultCounters').concat(
          App.get('Configs.tables.entity.vertex') || [],
          App.get('Configs.tables.sharedColumns') || []
        )
      )
    );
  }.property(),

});
