/*
* Copyright (c) 2019 Software AG, Darmstadt, Germany and/or its licensors
*
* SPDX-License-Identifier: Apache-2.0
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
 */
import { Component, DoCheck, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import { Realtime, InventoryService } from '@c8y/client';
import * as _ from 'lodash';
import { HttpClient } from "@angular/common/http";
import { IWidgetConfig } from "./i-widget-config";
import { IWeatherForecastDay } from "./i-weather-forecast-day";
import { BehaviorSubject } from "rxjs";

@Component({
    templateUrl: './weather-forecast-widget.component.html',
    styleUrls: ['./weather-forecast-widget.component.css'],
})

export class WeatherForecastWidget implements OnInit, OnDestroy, DoCheck {

    @Input() config: IWidgetConfig;

    private forecastRefreshTimerId: number;
    public weatherForecastDaysArray: IWeatherForecastDay[] = [];

    private cdkDropListContainer;
    private cdkDropListContainerHeight = 140;
    private cdkDropListContainerWidth = 200;

    private weatherImageContainerWidth = 70; // px
    private weatherImageContainerMarginTop = 10; //percent

    public weatherImageContainerStyle = new BehaviorSubject<{ width: string, 'margin-top': string }>({
        width: this.weatherImageContainerWidth + 'px',
        'margin-top': this.weatherImageContainerMarginTop + '%'
    });

    private weatherDataContainerHeight = 140;
    private weatherDataContainerMarginTop = 0;
    private weatherDataContainerFontSize = 14;
    public weatherDataContainerStyle = new BehaviorSubject<{ height: string, 'margin-top': string, 'font-size': string }>({
        height: this.weatherDataContainerHeight + 'px',
        'margin-top': this.weatherDataContainerMarginTop + 'px',
        'font-size': this.weatherDataContainerFontSize + 'px'
    });

    private weatherTemperatureContainerHeight = 140;
    private weatherTemperatureContainerMarginTop = 0;
    private weatherTemperatureContainerFontSize = 25;
    public weatherTemperatureContainerStyle = new BehaviorSubject<{ height: string, 'margin-top': string, 'font-size': string }>({
        height: this.weatherTemperatureContainerHeight + 'px',
        'margin-top': this.weatherTemperatureContainerMarginTop + 'px',
        'font-size': this.weatherTemperatureContainerFontSize + 'px'
    });

    constructor(
        private http: HttpClient,
        private realtime: Realtime,
        private invSvc: InventoryService,
        private elRef: ElementRef) {
    }

    ngOnInit() {
        if (this.config.refreshPeriod === undefined) {
            this.config.refreshPeriod = 1;
        }
        if (this.config.refreshPeriod <= 0) {
            this.config.refreshPeriod = 1;
        }
        if (this.config.refreshPeriod > 24) {
            this.config.refreshPeriod = 24;
        }
        if (this.config.days === undefined) {
            this.config.days = 5;
        }
        if (this.config.days <= 0) {
            this.config.days = 1;
        }
        if (this.config.days > 5) {
            this.config.days = 5;
        }
        this.updateForDeviceChange().then();
    }

    ngOnDestroy(): void {
        clearInterval(this.forecastRefreshTimerId);
    }

    private async updateForDeviceChange() {
        // Get the weather forecast data and filter/transform it
        await this.getDeviceLocation();
        await this.updateForecast();
        this.forecastRefreshTimerId = <any>setInterval(async () => {
            await this.updateForecast();
        }, this.config.refreshPeriod * 60 * 60 * 1000);
    }

    private async updateForecast() {
        try {
            const getForecastResponse = await this.getForecast();
            if (getForecastResponse == undefined || !_.has(getForecastResponse, `list`)) {
                return;
            }

            let allWeather = _.get(getForecastResponse, `list`)

            this.weatherForecastDaysArray = allWeather
                .filter(weatherForecastDay => weatherForecastDay.dt_txt !== undefined && (weatherForecastDay.dt_txt.includes('12:00:00')))
                .slice(0, this.config.days)
                .map(weatherForecastDay => {
                    return {
                        date: weatherForecastDay.dt_txt.substring(0, 10),
                        temp: weatherForecastDay.main.temp,
                        min_temp: weatherForecastDay.main.temp_min,
                        max_temp: weatherForecastDay.main.temp_max,
                        pressure: weatherForecastDay.main.pressure,
                        humidity: weatherForecastDay.main.humidity,
                        wind: weatherForecastDay.wind,
                        overview: weatherForecastDay.weather[0].main,
                        desc: weatherForecastDay.weather[0].description,
                        icon: weatherForecastDay.weather[0].icon
                    };
                });
        } catch (error) {
            console.error(error);
        }
    }

    private getForecast() {
        if (_.has(this.config, 'city')) {
            return this.http.get(`https://api.openweathermap.org/data/2.5/forecast?q=${this.config.city}&units=metric&appid=${this.config.apikey}`).toPromise()
                .catch(error => {
                    throw new Error(`Error retrieving weather forecast by city '${this.config.city}' : ${JSON.stringify(error)}`);
                })
        } else if (this.config.latitude && this.config.longitude) {
            return this.http.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${this.config.latitude}&lon=${this.config.longitude}&units=metric&appid=${this.config.apikey}`).toPromise()
                .catch(error => {
                    throw new Error(`Error retrieving weather forecast by latitude '${this.config.latitude}' and longitude '${this.config.longitude}' : ${JSON.stringify(error)}`);
                });
        } else {
            throw new Error(`Weather Forecast widget location (city or latitude and longitude) has not been set correctly.`);
        }
    }

    private async getDeviceLocation() {
        if (_.has(this.config, 'device.id')) {
            const mo = await this.getTargetObject(this.config.device.id);
            if (mo && mo.c8y_Position) {
                // console.log("Position:" + mo.c8y_Position);
                this.config.latitude = mo.c8y_Position.lat;
                this.config.longitude = mo.c8y_Position.lng;
            } else {
                // if the device doesn't have a location, default to London
                console.error(`The device selected for the Weather widget does not have a location, defaulting weather widget to 'London'`);
                this.config.city = 'London';
            }
        } else if (this.config.city === undefined || this.config.city === '') {
            // if the device and city haven't been set, default to London
            console.error(`A device has not been selected and a city name has not been entered, the weather forecast widget default location has been set to 'London'`);
            this.config.city = 'London';
        }
    }

    private getTargetObject(deviceId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.invSvc.detail(deviceId)
                .then((resp) => {
                    if (resp.res.status == 200) {
                        resolve(resp.data);
                    } else {
                        reject(resp);
                    }
                });
        });
    }

    public ngDoCheck() {
        this.cdkDropListContainer = this.elRef.nativeElement.parentNode.parentNode.parentNode.parentNode;
        if (this.cdkDropListContainer) {
            this.cdkDropListContainerHeight = this.cdkDropListContainer.offsetHeight;
            this.cdkDropListContainerWidth = this.cdkDropListContainer.offsetWidth;

            console.log('this.cdkDropListContainerHeight is', this.cdkDropListContainerHeight);
            console.log('this.cdkDropListContainerWidth is', this.cdkDropListContainerWidth);

            this.weatherImageContainerWidth = 70; // px
            this.weatherImageContainerMarginTop = 10; //percent

            this.weatherDataContainerHeight = 140;
            this.weatherDataContainerMarginTop = 0;
            this.weatherDataContainerFontSize = 14;

            this.weatherTemperatureContainerHeight = 140;
            this.weatherTemperatureContainerMarginTop = 0;
            this.weatherTemperatureContainerFontSize = 25;

            // if the widget has been squashed down
            if (this.cdkDropListContainerHeight < 216 || this.cdkDropListContainerWidth <= 249) {
                console.log('Container height is < 216');

                this.weatherImageContainerWidth = 60; // px

                this.weatherDataContainerHeight = 55;
                this.weatherDataContainerFontSize = 10;

                this.weatherTemperatureContainerHeight = 50;
                this.weatherTemperatureContainerFontSize = 15;


                const c8yDashboardChildTitle = this.cdkDropListContainer.querySelector('c8y-dashboard-child-title');
                const widgetTitleDisplayValue: string = window.getComputedStyle(c8yDashboardChildTitle).getPropertyValue('display');
                if (widgetTitleDisplayValue !== undefined && widgetTitleDisplayValue !== null && widgetTitleDisplayValue === 'none') {
                    console.log('header is hidden');
                    this.weatherImageContainerMarginTop = 20; //percent
                } else {
                    this.weatherImageContainerMarginTop = 0; //percent
                    this.weatherTemperatureContainerMarginTop = 0;
                    this.weatherDataContainerMarginTop = 0;
                }
            }

            // If the widget is a standard size
            if (this.cdkDropListContainerHeight >= 216 && this.cdkDropListContainerWidth > 249) {
                console.log('Container height is >= 216 and width >= 249');
                this.weatherImageContainerMarginTop = 10; // percent
                this.weatherImageContainerWidth = 125; // px
                this.weatherTemperatureContainerHeight = this.cdkDropListContainerHeight / 1.545;
                this.weatherTemperatureContainerFontSize = 25;
                this.weatherDataContainerHeight = this.cdkDropListContainerHeight / 1.545;
                this.weatherDataContainerFontSize = 14;
            }

            // Update the css attributes for the weather image container
            this.weatherImageContainerStyle.next({
                width: this.weatherImageContainerWidth + 'px',
                'margin-top': this.weatherImageContainerMarginTop + '%'
            });

            // Update the css attributes for the weather temperature container
            this.weatherTemperatureContainerStyle.next({
                height: this.weatherTemperatureContainerHeight + 'px',
                'margin-top': this.weatherTemperatureContainerMarginTop + 'px',
                'font-size': this.weatherTemperatureContainerFontSize + 'px'
            });

            // Update the css attributes for the weather data container
            this.weatherDataContainerStyle.next({
                height: this.weatherDataContainerHeight + 'px',
                'margin-top': this.weatherDataContainerMarginTop + 'px',
                'font-size': this.weatherDataContainerFontSize + 'px'
            });
        }
    }
}

