export function home_schedule(input_data) {
    /*Конфиг тестирования данных*/
    const mode = {
        undefined: {
            duration: 24,
            from: 0,
            to: 23
        },
        day: {
            duration: 14,
            from: 7,
            to: 21
        },
        night: {
            duration: 10,
            from: 21,
            to: 7
        }
    };
    /* инициализация mode.total_power */
    Object.keys(mode).forEach(m => {
        m.total_power = m.duration * input_data.maxPower;
    });

    let schedule = {};
    for(let i = 0; i <24 ; schedule[i++]=[]);
    let available = available_construct(input_data.rates, input_data.maxPower);

    /*Тест превышения прибором максимальной мощности и сортировка по мощности*/
    input_data.devices.sort((a, b) => { return b.power - a.power; });
    if (input_data.devices[0].power > input_data.maxPower) {
        throw Error('maxPower exceeded! id:' + input_data.devices[0].id);
    }

    /* Сортировка по длительности */
    const devices_duration = input_data.devices.slice().sort((a, b) => { return b.duration - a.duration; });
    devices_duration.push({ duration: 0 });

    /* Подготовка и тесты приборов*/
    input_data.devices.forEach(device => {
        device.start_at = false;
        power_peak_test(device,input_data.maxPower, devices_duration, mode);
        total_power_counter(device, mode);
        device.available = device_available_construct(device, available, mode);
        if (device.duration == 24) {
            Object.assign(device,{start_at:0,price_min_delta:0,schedule_price:device.available[0].price});
            write_to_schedule(device.available[0],schedule,available,device);
        } else {
            device_delta_sort(device);
        }
    });

    /*Расстановка остальных приборов c фильтрацией круглосуточных и сортировкой по мин. дельте*/
    const devices_delta = input_data.devices.filter(dev=>{return dev.start_at === false}).sort((a, b) => { return b.price_min_delta - a.price_min_delta; });
    devices_delta.forEach(device => put_device_in_schedule(device,schedule,available));

    /*конструкция исходящего формата данных*/
    const output_data = {
        schedule:schedule,
        consumedEnergy:{
            value:0,
            devices:{}
        }
    };
    input_data.devices.forEach(device=>{
        output_data.consumedEnergy.value += device.schedule_price;
        output_data.consumedEnergy.devices[device.id] = device.schedule_price;
    });
    return output_data;
}


/*Для перехода for между сутками*/
function hour_counter(i, from, to, callback) {
    if (i >= to) {
        if (to < from && from <= i) {
            if (i > 23) callback();
        } else return false;
    }
    return true;
}
/*Объект расписания с доступной мощностью и ценой*/
function available_construct (rates,maxPower){
    const available = []; 
    rates.forEach(rate => {
        for(let i = rate.from; hour_counter(i,rate.from,rate.to,()=>{i = 0}); ++i){
            available[i] = {
                rate:rate.value,
                maxPower:maxPower
            };
        }
    });
    return available;
}
/*Тест пика мощности todo: power_peak_test требует доработки учета пересечений с не клуглосуточными приборами */
function power_peak_test(device, maxPower, durations, mode) {
    let device_maxPower = maxPower - device.power;
    for (let i = 0; durations[i].duration > 23; ++i) {
        if (durations[i].id != device.id) {
            device_maxPower -= durations[i].power;
        }
    }
    if (device.mode !== undefined) {
        for (let i = 0; durations[i].duration > mode[device.mode].duration - 1; ++i) {
            if (device.mode === durations[i].mode && durations[i].id != device.id) {
                device_maxPower -= durations[i].power;
            }
        }
    }
    if (device_maxPower < 0) {
        throw Error(`maxPower exceeded by id:${device.id} and others, working at the same time!`);
    }
}
/*Тест Общей мощности и day/night промежутков*/
function total_power_counter(device,mode) {
    mode.undefined.total_power -= device.power * device.duration;
    if (device.mode !== undefined) {
        mode[device.mode].total_power -= device.power * device.duration;
    } else {
        if (device.duration > mode.night.duration) {
            mode.day.total_power -= device.power * (device.duration - mode.night.duration);
        }
        if (device.duration > mode.day.duration) {
            mode.night.total_power -= device.power * (device.duration - mode.day.duration);
        }
    }
    Object.keys(mode).forEach(mode_name => {
        if (mode[mode_name].total_power < 0) {
            throw Error(`maxPower exceeded by total power of ${mode_name}-mode devices!`);
        }
    });
}
/*Расчет стоимости включений прибора, для 24-приборов только один расчет, от 0:00*/
function device_available_construct(device, available, mode) {
    let dev_available = [];
    let to = (device.mode === undefined) ? mode[device.mode].to : mode[device.mode].to - device.duration;
    if (to < 0) {
        to = (device.duration == 24) ? 1 : to + 24;
    }
    for (let i = mode[device.mode].from; hour_counter(i, mode[device.mode].from, to, () => { i = 0 }); ++i) {
        dev_available.push({ price: price_round(device.power/1000 * available[i].rate), 'start': i });
        let end = 0;
        let dev_i = dev_available.length - 1;
        for (let d = 1; d < device.duration; ++d) {
            end = (i + d > 23) ? i + d - 24 : i + d;
            dev_available[dev_i].price += price_round(device.power/1000 * available[end].rate);
        }
        //dev_available[dev_i].price = price_round(dev_available[dev_i].price);
        dev_available[dev_i].stop = end + 1;
    }
    return dev_available;
}

function price_round(price){
    return Math.round(price * 10000) / 10000;
}
/* Сортировака включений прибора по потреблению */
function device_delta_sort(device) {
    let min_delta = 1;
    device.available.sort((a, b) => { return (a.price === b.price) ? a.stop - b.stop : a.price - b.price; })
    for (; device.available[min_delta].price === device.available[0].price; ++min_delta);
    device.price_min_delta = device.available[min_delta].price - device.available[0].price;
    /*дополнительное определние максимальной дельты*/
    //device.price_delta = device.available[device.available.length - 1].price - device.available[0].price;
}
/* Расстановка приборов 24 */
function write_to_schedule(dev_available,schedule,available,device){
    for (let t = dev_available.start; hour_counter(t,dev_available.start,dev_available.stop,() => { t = 0 }); ++t) {
        available[t].maxPower -= device.power;
        schedule[t].push(device.id);
    }
}
/* Расстановка приборов. todo: перестоновка с рекурсией */
function put_device_in_schedule(device, schedule, available) {
    device.chosen = [];
    device.not_available = [];
    /*Обход всех доступных расписаний*/
    for (let s = 0; s < device.available.length; ++s) {
        device.available[s].maxPower = 0;
        if (device.chosen[0] !== undefined && device.available[s].price !== device.available[s - 1].price) {
            device.chosen.sort((a, b) => { return b.power - a.power });
            device.start_at = device.chosen[0].start;
            device.schedule_price = device.chosen[0].price;
            write_to_schedule(device.chosen[0],schedule,available,device);
            return true;
        } else {
            device.chosen.push(device.available[s]);
            /*Отбор вариантов с достаточной мощностью*/
            for (let t = device.available[s].start; hour_counter(t, device.available[s].start, device.available[s].stop, () => { t = 0 }); ++t) {
                if (available[t].maxPower >= device.power) {
                    device.available[s].maxPower += available[t].maxPower;
                } else {
                    device.not_available.push(device.chosen.pop());
                    break;
                }
            }
        }
    }
    console.log(device);
    console.log(schedule);
    console.log(available);
    throw Error(`Can't put id:${device.id} to schedule!`);
}