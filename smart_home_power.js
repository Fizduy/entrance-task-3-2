/* todo: вынести все этапы и процедуры в отдельные функции */
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

    /*Объект расписания с исходными данными */
    let schedule = schedule_construct(input_data.rates, input_data.maxPower);

    /*Тест превышения прибором максимальной мощности и сортировка*/
    input_data.devices.sort((a, b) => { return b.power - a.power; });
    if (input_data.devices[0].power > input_data.maxPower) {
        throw Error('maxPower exceeded! id:' + input_data.devices[0].id);
    }

    /* Сортировка по длительности */
    const devices_duration = input_data.devices.slice().sort((a, b) => { return b.duration - a.duration; });
    devices_duration.push({ duration: 0 });

    input_data.devices.forEach(device => {
        device.start_at = false;

        /*Тест пика мощности - todo: вынести из цикла, либо реализовать тест для пересечений с приборами менее 24 часа*/
        power_peak_test(device, devices_duration, mode);

        /*Тест Общей мощности и day/night промежутков*/
        total_power_counter(device, mode)

        /*Расчет стоимости включений прибора, для 24-приборов только один расчет, от 0:00*/
        device.schedule = device_schedule_construct(device, schedule, mode);

        /* Расстановка приборов 24 */
        if (device.duration == 24) {
            for (let t = 0; t < device.duration; ++t) {
                schedule[t].maxPower -= device.power;
                schedule[t].devices.push(device.id);
            }
            Object.assign(device,{start_at:0,price_delta:0,price_min_delta:0});
        } else {
            /* Сортировака остальных по потреблению */
            device.schedule.sort((a, b) => { return a.price - b.price; })
            device.price_delta = device.schedule[device.schedule.length - 1].price - device.schedule[0].price;

            let min_delta = 1;
            for (; device.schedule[min_delta].price === device.schedule[0].price; ++min_delta);
            device.price_min_delta = device.schedule[min_delta].price - device.schedule[0].price;
        }

    });

    /* Расстановка остальных приборов. todo: перестоновка с рекурсией */
    const devices_delta = input_data.devices.slice().sort((a, b) => { return b.price_min_delta - a.price_min_delta; });

    devices_delta.forEach(device => put_device_in_schedule(device, schedule, new_schedule => {schedule = new_schedule}));

    return schedule;
}

function hour_counter(i, from, to, callback) {
    if (i >= to) {
        if (to < from && from <= i) {
            if (i > 23) callback();
        } else return false;
    }
    return true;
}

function schedule_construct (rates,maxPower){
    const schedule = []; 
    rates.forEach(rate => {
        for(let i = rate.from; hour_counter(i,rate.from,rate.to,()=>{i = 0}); ++i){
            schedule[i] = {
                rate:rate.value,
                maxPower:maxPower,
                devices:[]
            };
        }
    });
    return schedule;
}

/*todo: power_peak_test требует доработки учета пересечений с не 24-приборами */
function power_peak_test(device, durations, mode) {
    let device_maxPower = input_data.maxPower - device.power;
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

function device_schedule_construct(device,schedule,mode){
        let dev_schedule = [];
        let to = (device.mode === undefined) ? mode[device.mode].to : mode[device.mode].to - device.duration;
        if(to < 0){
          to = (device.duration == 24) ? 1 : to + 24;
        }
        
    for (let i = mode[device.mode].from; hour_counter(i, mode[device.mode].from, to, () => { i = 0 }); ++i) {
        dev_schedule.push({ price: device.power/1000 * schedule[i].rate, 'start': i });
          let end = 0;
        let dev_i = dev_schedule.length - 1;
        for (let d = 1; d < device.duration; ++d) {
            end = (i + d > 23) ? i + d - 24 : i + d;
            dev_schedule[dev_i].price += device.power/1000 * schedule[end].rate;
          }
          dev_schedule[dev_i].stop = end+1;
        }
    return dev_schedule;
}

function put_device_in_schedule(device, schedule, callback) {
    for (let s = 0; s < device.schedule.length; ++s) {
        let checkout = true;
        const schedule_temp = Object.assign([], schedule);
        for (let t = device.schedule[s].start; hour_counter(t, device.schedule[s].start, device.schedule[s].stop, () => { t = 0 }); ++t) {
            if (schedule[t].maxPower >= device.power) {
                schedule_temp[t] = {
                    rate: schedule[t].rate,
                    maxPower: schedule[t].maxPower - device.power,
                    devices: schedule[t].devices.slice()
                };
                schedule_temp[t].devices.push(device.id);
            } else {
                checkout = false;
                break;
            }
        }
        if (checkout) {
            device.start_at = device.schedule[s].start;
            callback(schedule_temp);
            break;
        }
        throw Error(`Can't put id:${device.id} to schedule!`);
    }
}